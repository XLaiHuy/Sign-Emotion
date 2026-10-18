import type { OptionalMediaAsset } from '../../shared/optionalMedia';

export const OPTIONAL_MEDIA_CACHE = 'signemo-optional-media-v1';
async function verified(response: Response, asset: OptionalMediaAsset) {
  if (!response.ok || response.status === 206) return null;
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== asset.bytes) return null;
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  return hash === asset.sha256 ? bytes : null;
}
export async function optionalMediaSaved(asset: OptionalMediaAsset) {
  if (!('caches' in globalThis)) return false;
  try {
    const cache = await caches.open(OPTIONAL_MEDIA_CACHE);
    const response = await cache.match(asset.url);
    if (!response) return false;
    if (await verified(response, asset)) return true;
    await cache.delete(asset.url);
  } catch {
    /* Optional storage never prevents captions. */
  }
  return false;
}
export async function saveOptionalMedia(asset: OptionalMediaAsset, signal?: AbortSignal) {
  if (!('caches' in globalThis)) throw new Error('Trình duyệt chưa cho phép lưu clip offline.');
  const estimate = await navigator.storage?.estimate?.();
  if (
    estimate?.quota !== undefined &&
    estimate.usage !== undefined &&
    estimate.quota - estimate.usage < asset.bytes * 1.5
  )
    throw new Error('Chưa đủ dung lượng để lưu clip. Bạn vẫn có thể xem trực tuyến.');
  signal?.throwIfAborted();
  const response = await fetch(asset.url, { signal, cache: 'no-store' });
  const bytes = await verified(response, asset);
  if (!bytes) throw new Error('Clip tải chưa đầy đủ hoặc không đúng phiên bản. Hãy thử lại.');
  signal?.throwIfAborted();
  const cache = await caches.open(OPTIONAL_MEDIA_CACHE);
  signal?.throwIfAborted();
  await cache.put(
    asset.url,
    new Response(bytes, {
      headers: {
        'Content-Type': asset.contentType,
        'Content-Length': String(bytes.byteLength),
        'Accept-Ranges': 'bytes',
      },
    }),
  );
}
/** Saved videos support single byte ranges, including suffix ranges for seek. */
export async function cachedOptionalMedia(request: Request): Promise<Response | undefined> {
  let response: Response | undefined;
  try {
    response = await (await caches.open(OPTIONAL_MEDIA_CACHE)).match(request.url);
  } catch {
    return undefined; // An unavailable cache must not prevent online video playback.
  }
  if (!response) return undefined;
  const range = request.headers.get('range');
  if (!range) return response;
  const bytes = await response.arrayBuffer(),
    total = bytes.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  let start = match?.[1] ? Number(match[1]) : 0;
  let end = match?.[2] ? Number(match[2]) : total - 1;
  if (match && !match[1] && match[2]) {
    start = Math.max(0, total - Number(match[2]));
    end = total - 1;
  }
  if (
    !match ||
    (!match[1] && !match[2]) ||
    start > end ||
    start >= total ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end)
  )
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
  end = Math.min(end, total - 1);
  const headers = new Headers(response.headers);
  headers.set('Content-Range', `bytes ${start}-${end}/${total}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}
