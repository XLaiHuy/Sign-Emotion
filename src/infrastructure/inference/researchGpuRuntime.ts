/** Exact ONNX Runtime Web 1.30.0 Asyncify artifacts; only the explicit GPU profile uses these. */
export const GPU_RUNTIME_ASSETS = [
  {
    file: 'ort-wasm-simd-threaded.asyncify.mjs',
    bytes: 53057,
    sha256: '3d1c85995364bb643302fc6fd877a0c3ba5ae72401815e0f24828a53d9191e28',
  },
  {
    file: 'ort-wasm-simd-threaded.asyncify.wasm',
    bytes: 26781914,
    sha256: '39f9f0894d478800487ed9f7dbe92618498db320cf55c8e3d89adff8dce658da',
  },
] as const;

export function waitForGpuCacheController(signal?: AbortSignal, timeoutMs = 15_000) {
  signal?.throwIfAborted();
  const service = navigator.serviceWorker;
  if (!service) return Promise.reject(new Error('Trình duyệt chưa hỗ trợ bộ nhớ offline.'));
  if (service.controller) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      service.removeEventListener('controllerchange', changed);
      signal?.removeEventListener('abort', aborted);
      if (error) reject(error);
      else resolve();
    };
    const changed = () => {
      if (service.controller) finish();
    };
    const aborted = () => finish(new DOMException('Cancelled', 'AbortError'));
    const timer = setTimeout(
      () => finish(new Error('Chưa chuẩn bị xong bộ nhớ offline. Hãy thử lại.')),
      timeoutMs,
    );
    service.addEventListener('controllerchange', changed);
    signal?.addEventListener('abort', aborted, { once: true });
    changed();
  });
}

export async function prepareResearchGpuRuntime(signal?: AbortSignal) {
  signal?.throwIfAborted();
  // Dynamic module import and WASM fetch must both be served from this verified cache
  // by the controlling service worker. Fail explicitly rather than claiming offline readiness.
  await waitForGpuCacheController(signal);
  const cache = await caches.open('signemo-research-face-runtime-v1');
  for (const asset of GPU_RUNTIME_ASSETS) {
    signal?.throwIfAborted();
    const url = `/research/runtime-ort-gpu/${asset.file}`;
    const valid = async (response?: Response) => {
      if (!response?.ok) return null;
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength !== asset.bytes) return null;
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
        (value) => value.toString(16).padStart(2, '0'),
      ).join('');
      return hash === asset.sha256 ? bytes : null;
    };
    const cached = await valid(await cache.match(url));
    signal?.throwIfAborted();
    if (cached) continue;
    await cache.delete(url);
    const bytes = await valid(await fetch(url, { cache: 'reload', signal }));
    signal?.throwIfAborted();
    if (!bytes) throw new Error('Runtime GPU không khớp checksum.');
    await cache.put(
      url,
      new Response(bytes, {
        headers: {
          'Content-Type': asset.file.endsWith('.mjs')
            ? 'application/javascript'
            : 'application/wasm',
        },
      }),
    );
  }
}
