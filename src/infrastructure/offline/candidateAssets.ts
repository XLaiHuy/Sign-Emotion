import { GIPFORMER_MANIFEST } from '../inference/gipformer-assets';
import { B0_PROFILE } from '../inference/face-model-profile';
import { GPU_RUNTIME_ASSETS } from '../inference/researchGpuRuntime';
import {
  verifyBytes,
  verifyCachedAsset,
  markCachedAssetVerified,
  forgetCachedAsset,
} from './assets';
import { ModelInitializationError } from '../../domain/modelInitialization';
import { downloadCandidate } from './downloadCandidate';
import { conversationProfile } from '../inference/conversationProfile';
import { MOONSHINE_ASSETS, MOONSHINE_CACHE } from '../inference/moonshine-assets';

export const candidateAssets = [
  ...(conversationProfile().asr === 'moonshine-streaming-vi-research'
    ? MOONSHINE_ASSETS.map((asset) => ({ ...asset, cache: MOONSHINE_CACHE }))
    : GIPFORMER_MANIFEST.assets.map((asset) => ({
        url: `/research/gipformer/${asset.file}`,
        bytes: asset.size,
        sha256: asset.sha256,
        cache: 'signemo-research-gipformer-v1',
      }))),
  {
    url: B0_PROFILE.url,
    bytes: B0_PROFILE.bytes,
    sha256: B0_PROFILE.sha256,
    cache: 'signemo-research-face-v1',
  },
  ...GPU_RUNTIME_ASSETS.map((asset) => ({
    url: `/research/runtime-ort-gpu/${asset.file}`,
    bytes: asset.bytes,
    sha256: asset.sha256,
    cache: 'signemo-research-face-runtime-v1',
  })),
].map((asset) => ({
  ...asset,
  source: 'Pinned candidate artifact',
  license: 'See model/runtime source manifest',
}));
export const candidateAssetBytes = candidateAssets.reduce((sum, asset) => sum + asset.bytes, 0);

export async function candidateAssetsReady() {
  for (const asset of candidateAssets) {
    const cache = await caches.open(asset.cache);
    const response = await cache.match(asset.url);
    if (!response) return false;
    try {
      await verifyCachedAsset(asset.cache, response, asset);
    } catch {
      return false;
    }
  }
  return true;
}

/** Downloads have byte progress and cancellation, outside the worker initialization deadline. */
export async function prepareCandidateAssets(
  progress: (done: number, total: number) => void,
  signal?: AbortSignal,
) {
  let done = 0;
  for (const asset of candidateAssets) {
    signal?.throwIfAborted();
    const cache = await caches.open(asset.cache);
    const saved = await cache.match(asset.url);
    let valid = false;
    if (saved) {
      try {
        await verifyCachedAsset(asset.cache, saved, asset);
        valid = true;
      } catch {
        forgetCachedAsset(asset.cache, asset);
        await cache.delete(asset.url);
      }
    }
    if (!valid) {
      const buffer = await downloadCandidate(
        asset,
        (received) => progress(done + received, candidateAssetBytes),
        signal,
      );
      try {
        await verifyBytes(buffer.buffer, asset);
      } catch {
        throw new ModelInitializationError('integrity');
      }
      signal?.throwIfAborted();
      await cache.put(
        asset.url,
        new Response(buffer, {
          headers: {
            'Content-Type': asset.url.endsWith('.mjs')
              ? 'application/javascript'
              : asset.url.endsWith('.wasm')
                ? 'application/wasm'
                : 'application/octet-stream',
            'Cross-Origin-Embedder-Policy': 'require-corp',
          },
        }),
      );
      markCachedAssetVerified(asset.cache, asset);
    }
    done += asset.bytes;
    progress(done, candidateAssetBytes);
  }
  signal?.throwIfAborted();
  // Workers can now initialize from this verified, bounded manifest while offline.
  if (conversationProfile().asr !== 'moonshine-streaming-vi-research')
    await (
      await caches.open('signemo-research-gipformer-v1')
    ).put(
      '/research/gipformer/manifest.json',
      new Response(JSON.stringify(GIPFORMER_MANIFEST), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  if (!(await candidateAssetsReady())) throw new ModelInitializationError('storage');
  signal?.throwIfAborted();
}
