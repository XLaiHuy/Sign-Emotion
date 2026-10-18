import { z } from 'zod';
import { selectedSpeechAssets } from '../inference/conversationProfile';
import { downloadCandidate } from './downloadCandidate';
import {
  forgetCachedAsset,
  markCachedAssetVerified,
  verifyBytes,
  verifyCachedAsset,
} from './assets';
export const PACK_CACHE = 'signemo-conversation-v1';
const assetSchema = z.object({
  url: z.string().regex(/^\/(models\/local|runtime\/speech)\//),
  bytes: z.number().int().positive().max(200_000_000),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  source: z.string(),
  license: z.string(),
  pack: z.string().optional(),
});
const manifestSchema = z.object({
  version: z.enum(['conversation-v1', 'conversation-v2']),
  packs: z.array(
    z.object({
      id: z.enum(['speech', 'emotion', 'speech-base']),
      experimental: z.boolean(),
      assets: z.array(assetSchema),
    }),
  ),
});
export type FeaturePack = z.infer<typeof manifestSchema>['packs'][number];
let obsoleteCacheCleanup: Promise<void> | null = null;
const obsoleteAsset = (url: string) =>
  url.includes('/onnx-community/whisper-base/') ||
  url.includes('/onnx-community/Speech-Emotion-Classification-ONNX/');
async function cleanObsoleteAssets() {
  if (!obsoleteCacheCleanup) {
    obsoleteCacheCleanup = (async () => {
      const cache = await caches.open(PACK_CACHE);
      const requests = await cache.keys();
      await Promise.all(
        requests
          .filter((request) => obsoleteAsset(new URL(request.url).pathname))
          .map((request) => cache.delete(request)),
      );
    })().catch(() => {
      obsoleteCacheCleanup = null;
    });
  }
  await obsoleteCacheCleanup;
}
let frozenPacks: Promise<FeaturePack[]> | null = null;
export async function loadPacks(signal?: AbortSignal): Promise<FeaturePack[]> {
  signal?.throwIfAborted();
  frozenPacks ??= readPacks(signal).catch((error) => {
    frozenPacks = null;
    throw error;
  });
  const packs = await frozenPacks;
  signal?.throwIfAborted();
  return packs;
}
async function readPacks(signal?: AbortSignal): Promise<FeaturePack[]> {
  const url = '/models/conversation-manifest.json';
  let response: Response;
  let fresh = false;
  try {
    response = await fetch(url, { cache: 'no-cache', signal });
    fresh = response.ok;
  } catch (error) {
    if (signal?.aborted) throw error;
    const cached = await (await caches.open(PACK_CACHE)).match(url);
    if (!cached) throw error;
    response = cached;
  }
  if (!response.ok) {
    const cached = await (await caches.open(PACK_CACHE)).match(url);
    if (cached) response = cached;
    else
      throw new Error(
        'Thiếu tài nguyên hội thoại. Chạy npm run assets:conversation rồi build lại.',
      );
  }
  const manifest = manifestSchema.parse(await response.json());
  // Save validated metadata before any package download and before SW control.
  if (fresh)
    await (
      await caches.open(PACK_CACHE)
    ).put(
      url,
      new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/json' } }),
    );
  await cleanObsoleteAssets();
  return manifest.packs
    .filter((pack): pack is typeof pack & { id: 'speech' | 'emotion' } => pack.id !== 'speech-base')
    .map((pack) => ({
      ...pack,
      assets: (pack.id === 'speech' ? selectedSpeechAssets(pack.assets) : pack.assets).filter(
        (asset) => !obsoleteAsset(asset.url),
      ),
    }))
    .filter((pack) => pack.assets.length > 0);
}
export async function packReady(pack: FeaturePack) {
  const cache = await caches.open(PACK_CACHE);
  for (const asset of pack.assets) {
    const response = await cache.match(asset.url);
    if (!response) return false;
    try {
      await verifyCachedAsset(PACK_CACHE, response, asset);
    } catch {
      forgetCachedAsset(PACK_CACHE, asset);
      await cache.delete(asset.url);
      return false;
    }
  }
  return true;
}
export async function packReadiness() {
  const packs = await loadPacks();
  const readiness = await Promise.all(
    packs.map(async (pack) => [pack.id, await packReady(pack)] as const),
  );
  return Object.fromEntries(readiness) as Partial<Record<FeaturePack['id'], boolean>>;
}
export async function preparePack(
  pack: FeaturePack,
  progress: (bytes: number, total: number) => void,
  signal?: AbortSignal,
  repairAttempt = 0,
) {
  const cache = await caches.open(PACK_CACHE);
  let done = 0;
  const total = pack.assets.reduce((sum, a) => sum + a.bytes, 0);
  for (const asset of pack.assets) {
    signal?.throwIfAborted();
    let cached = await cache.match(asset.url);
    if (cached) {
      try {
        await verifyCachedAsset(PACK_CACHE, cached.clone(), asset);
      } catch {
        cached = undefined;
        forgetCachedAsset(PACK_CACHE, asset);
        await cache.delete(asset.url);
      }
    }
    if (!cached) {
      const data = await downloadCandidate(
        asset,
        (received) => progress(done + received, total),
        signal,
      );
      await verifyBytes(data.buffer, asset);
      signal?.throwIfAborted();
      await cache.put(
        asset.url,
        new Response(data.buffer, {
          headers: {
            'Content-Type': asset.url.endsWith('.wasm')
              ? 'application/wasm'
              : asset.url.endsWith('.mjs')
                ? 'application/javascript'
                : 'application/octet-stream',
          },
        }),
      );
      markCachedAssetVerified(PACK_CACHE, asset);
    }
    done += asset.bytes;
    progress(done, total);
  }
  signal?.throwIfAborted();
  // A browser can evict earlier CacheStorage entries while a large pack is
  // being written. Reconcile once so progress reaching 100% never means only
  // that bytes were fetched; the complete package must still be readable.
  if (!(await packReady(pack))) {
    if (repairAttempt >= 1)
      throw new Error('Một số model chưa được giữ trong bộ nhớ trình duyệt. Hãy thử chuẩn bị lại.');
    await preparePack(pack, progress, signal, repairAttempt + 1);
  }
}
export async function removePack(pack: FeaturePack, remaining: FeaturePack[]) {
  const cache = await caches.open(PACK_CACHE);
  for (const asset of pack.assets)
    if (!remaining.some((p) => p.id !== pack.id && p.assets.some((a) => a.url === asset.url)))
      await cache.delete(asset.url);
}
