import type { ModelManifest } from '../../shared/contracts';
import { downloadCandidate } from './downloadCandidate';
import { runAssetQueue } from './runAssetQueue';
import { conversationProfile, selectedCoreAssets } from '../inference/conversationProfile';
export const ASSET_CACHE = 'signemo-models-v1';
const verifiedCachedAssets = new Map<string, Promise<void>>();
function cachedAssetKey(cacheName: string, asset: ModelManifest['assets'][number]) {
  return `${cacheName}:${asset.url}:${asset.bytes}:${asset.sha256}`;
}
export function forgetCachedAsset(cacheName: string, asset: ModelManifest['assets'][number]) {
  verifiedCachedAssets.delete(cachedAssetKey(cacheName, asset));
}
export function markCachedAssetVerified(cacheName: string, asset: ModelManifest['assets'][number]) {
  verifiedCachedAssets.set(cachedAssetKey(cacheName, asset), Promise.resolve());
}
export async function verifyCachedAsset(
  cacheName: string,
  response: Response,
  asset: ModelManifest['assets'][number],
) {
  const key = cachedAssetKey(cacheName, asset);
  const previous = verifiedCachedAssets.get(key);
  if (previous) return previous;
  const verification = verifyAsset(response, asset).then(() => undefined);
  verifiedCachedAssets.set(key, verification);
  try {
    await verification;
  } catch (error) {
    verifiedCachedAssets.delete(key);
    throw error;
  }
}
async function bounded<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const clean = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => {
      clean();
      reject(new DOMException('Đã hủy tải', 'AbortError'));
    };
    const timer = setTimeout(() => {
      clean();
      reject(new Error('Service worker chưa sẵn sàng; hãy mở lại ứng dụng.'));
    }, 10_000);
    signal?.addEventListener('abort', abort, { once: true });
    promise.then(
      (value) => {
        clean();
        resolve(value);
      },
      (error) => {
        clean();
        reject(error);
      },
    );
  });
}
let frozenManifest: Promise<ModelManifest> | null = null;
export async function loadManifest(signal?: AbortSignal): Promise<ModelManifest> {
  signal?.throwIfAborted();
  frozenManifest ??= readManifest(signal).catch((error) => {
    frozenManifest = null;
    throw error;
  });
  const manifest = await frozenManifest;
  signal?.throwIfAborted();
  return manifest;
}
async function readManifest(signal?: AbortSignal): Promise<ModelManifest> {
  const url = '/models/manifest.json';
  let response: Response;
  let fresh = false;
  try {
    response = await fetch(url, { cache: 'no-cache', signal });
    fresh = response.ok;
  } catch (error) {
    if (signal?.aborted) throw error;
    const cached = await (await caches.open(ASSET_CACHE)).match(url);
    if (!cached) throw error;
    response = cached;
  }
  if (!response.ok) {
    const cached = await (await caches.open(ASSET_CACHE)).match(url);
    if (cached) response = cached;
    else throw new Error('Thiếu model. Chạy npm run assets:prepare rồi tải lại.');
  }
  const manifest = (await response.json()) as ModelManifest;
  if (
    !manifest.assets?.length ||
    !manifest.assets.every((a) => a.url.startsWith('/models/') || a.url.startsWith('/runtime/'))
  )
    throw new Error('Danh mục model không hợp lệ');
  manifest.assets = selectedCoreAssets(manifest.assets);
  if (conversationProfile().id === 'pc-candidate') {
    // Remove only the retired model from our core cache, never settings/vault/feedback.
    const cache = await caches.open(ASSET_CACHE);
    await cache.delete('/models/enet_b2_8.onnx').catch(() => false);
  }
  if (fresh)
    await (
      await caches.open(ASSET_CACHE)
    ).put(
      url,
      new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/json' } }),
    );
  return manifest;
}
export async function verifyAsset(response: Response, asset: ModelManifest['assets'][number]) {
  const buffer = await response.arrayBuffer();
  await verifyBytes(buffer, asset);
  return buffer;
}
export async function verifyBytes(buffer: ArrayBuffer, asset: ModelManifest['assets'][number]) {
  if (buffer.byteLength !== asset.bytes) throw new Error('Tài nguyên chưa tải đầy đủ');
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), (v) =>
    v.toString(16).padStart(2, '0'),
  ).join('');
  if (hash !== asset.sha256) throw new Error('Tài nguyên không khớp checksum');
}
export async function modelAssetsReady() {
  if (!('caches' in window)) return false;
  const manifest = await loadManifest();
  const cache = await caches.open(ASSET_CACHE);
  let complete = true;
  for (const asset of manifest.assets) {
    const response = await cache.match(asset.url);
    if (!response) {
      complete = false;
      continue;
    }
    try {
      await verifyCachedAsset(ASSET_CACHE, response, asset);
    } catch {
      forgetCachedAsset(ASSET_CACHE, asset);
      complete = false;
      await cache.delete(asset.url);
    }
  }
  return complete;
}
export async function checkOfflineReady() {
  if (!('serviceWorker' in navigator) || !(await modelAssetsReady())) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  const controller = navigator.serviceWorker.controller;
  if (!registration?.active || !controller) return false;
  // Ask the active worker to verify its complete precache, not only index.html.
  return new Promise<boolean>((resolve) => {
    const channel = new MessageChannel();
    const finish = (value: boolean) => {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      resolve(value);
    };
    const timer = setTimeout(() => finish(false), 3000);
    channel.port1.onmessage = (e) => finish(e.data?.complete === true);
    controller.postMessage({ type: 'CHECK_APP_CACHE' }, [channel.port2]);
  });
}
export async function prepareOffline(
  onProgress: (label: string, done: number, total: number) => void,
  signal?: AbortSignal,
  assetsOnly = false,
) {
  signal?.throwIfAborted();
  if (import.meta.env.DEV && !assetsOnly)
    throw new Error('Để thử offline, chạy npm run build rồi npm run preview.');
  if (!('caches' in window) || (!assetsOnly && !('serviceWorker' in navigator)))
    throw new Error('Trình duyệt chưa hỗ trợ lưu offline.');
  const manifest = await loadManifest(signal);
  const cache = await caches.open(ASSET_CACHE);
  await runAssetQueue(
    manifest.assets,
    async (asset, report, signal) => {
      signal?.throwIfAborted();
      let response = await cache.match(asset.url);
      if (response) {
        try {
          await verifyCachedAsset(ASSET_CACHE, response.clone(), asset);
        } catch {
          forgetCachedAsset(ASSET_CACHE, asset);
          await cache.delete(asset.url);
          response = undefined;
        }
      }
      if (!response) {
        const bytes = await downloadCandidate(asset, report, signal);
        const buffer = bytes.buffer;
        await verifyBytes(buffer, asset);
        signal?.throwIfAborted();
        await cache.put(
          asset.url,
          new Response(buffer, {
            headers: {
              'Content-Type': asset.url.endsWith('.wasm')
                ? 'application/wasm'
                : asset.url.endsWith('.mjs') || asset.url.endsWith('.js')
                  ? 'application/javascript'
                  : 'application/octet-stream',
            },
          }),
        );
        markCachedAssetVerified(ASSET_CACHE, asset);
      }
    },
    (asset, done, total) => onProgress(asset.url.split('/').pop()!, done, total),
    signal,
  );
  await cache.put(
    '/models/manifest.json',
    new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/json' } }),
  );
  if (!assetsOnly) await ensureOfflineApp(signal);
  return manifest;
}
export async function ensureOfflineApp(signal?: AbortSignal) {
  if (!('serviceWorker' in navigator)) throw new Error('Trình duyệt chưa hỗ trợ ngoại tuyến.');
  signal?.throwIfAborted();
  await bounded(navigator.serviceWorker.ready, signal);
  if (!navigator.serviceWorker.controller) {
    let changed!: () => void;
    try {
      await bounded(
        new Promise<void>((resolve) => {
          changed = resolve;
          navigator.serviceWorker.addEventListener('controllerchange', changed, { once: true });
        }),
        signal,
      );
    } finally {
      navigator.serviceWorker.removeEventListener('controllerchange', changed);
    }
  }
  signal?.throwIfAborted();
  if (!(await checkOfflineReady()))
    throw new Error('Chưa đủ cache ứng dụng/model. Hãy tải lại trang rồi kiểm tra lại.');
  signal?.throwIfAborted();
}
