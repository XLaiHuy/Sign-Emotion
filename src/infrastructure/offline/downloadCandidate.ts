import { ModelInitializationError } from '../../domain/modelInitialization';
import { immutableAssetUrl } from './immutableAssetUrl';

/** Bounded retry/resume for immutable model bytes; no partial file is ever cached. */
export async function downloadCandidate(
  asset: { url: string; bytes: number; sha256?: string; source?: string },
  progress: (received: number) => void,
  signal?: AbortSignal,
) {
  // Vite/dev and older Docker servers keep working via the original URL.
  let transportUrl = import.meta.env.DEV ? asset.url : (immutableAssetUrl(asset) ?? asset.url);
  let mayFallback = transportUrl !== asset.url;
  let canFallbackToSource = Boolean(asset.source && /^https?:\/\//.test(asset.source));
  const buffer = new Uint8Array(asset.bytes);
  let received = 0;
  let lastProgress = -Infinity;
  for (let attempt = 0; attempt < 3; attempt++) {
    signal?.throwIfAborted();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await fetch(transportUrl, {
        signal,
        cache: transportUrl === asset.url ? 'reload' : 'default',
        ...(received ? { headers: { Range: `bytes=${received}-` } } : {}),
      });
      if (
        mayFallback &&
        !received &&
        (response.status === 404 ||
          (response.status === 200 && response.headers.get('Content-Type')?.includes('text/html')))
      ) {
        await response.body?.cancel().catch(() => {});
        transportUrl = asset.url;
        mayFallback = false;
        // At most one compatibility probe, followed by the same three attempts.
        attempt--;
        continue;
      }
      if (
        canFallbackToSource &&
        !received &&
        (response.status === 404 ||
          (response.status === 200 && response.headers.get('Content-Type')?.includes('text/html')))
      ) {
        await response.body?.cancel().catch(() => {});
        transportUrl = asset.source!;
        canFallbackToSource = false;
        attempt--;
        continue;
      }
      if (
        !received &&
        (response.status === 404 ||
          (response.status === 200 && response.headers.get('Content-Type')?.includes('text/html')))
      ) {
        await response.body?.cancel().catch(() => {});
        throw new ModelInitializationError('missing-assets');
      }
      if (!response.ok) throw new TypeError('Model connection failed');
      if (response.status === 206) {
        const range = response.headers.get('Content-Range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
        if (
          !range ||
          Number(range[1]) !== received ||
          Number(range[2]) !== asset.bytes - 1 ||
          Number(range[3]) !== asset.bytes
        )
          throw new ModelInitializationError('integrity');
      } else received = 0; // A server that ignores Range must restart, never append duplicate bytes.
      if (response.body) {
        reader = response.body.getReader();
        while (true) {
          signal?.throwIfAborted();
          const part = await reader.read();
          if (part.done) break;
          if (received + part.value.length > buffer.length)
            throw new ModelInitializationError('integrity');
          buffer.set(part.value, received);
          received += part.value.length;
          const now = performance.now();
          if (now - lastProgress >= 100 || received === buffer.length) {
            progress(received);
            lastProgress = now;
          }
        }
      } else {
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (received + bytes.length > buffer.length)
          throw new ModelInitializationError('integrity');
        buffer.set(bytes, received);
        received += bytes.length;
      }
      if (received !== buffer.length) throw new TypeError('Model transfer interrupted');
      progress(received);
      return buffer;
    } catch (error) {
      await reader?.cancel().catch(() => {});
      signal?.throwIfAborted();
      if (error instanceof ModelInitializationError) throw error;
      // Some streams fail after delivering their last chunk. The caller still
      // verifies SHA-256; do not issue an impossible Range starting at EOF.
      if (received === buffer.length) {
        progress(received);
        return buffer;
      }
      if (attempt === 2) throw new ModelInitializationError('network');
    } finally {
      reader?.releaseLock();
    }
  }
  throw new ModelInitializationError('network');
}
