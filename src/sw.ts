/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, matchPrecache } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { cachedOptionalMedia } from './infrastructure/offline/optionalMedia';
declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};
const appAssets = self.__WB_MANIFEST;
function workerCompatible(response: Response) {
  const headers = new Headers(response.headers);
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
precacheAndRoute(appAssets);
cleanupOutdatedCaches();
// Only an explicit save writes optional media; it is never part of AI preparation.
registerRoute(
  ({ request, url }) =>
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/demo/') || url.pathname.startsWith('/sign-language/')) &&
    /\.(mp4|vtt)$/.test(url.pathname),
  async ({ request }) => (await cachedOptionalMedia(request)) ?? fetch(request),
);
registerRoute(
  ({ request, url }) =>
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/models/moonshine/') ||
      url.pathname.startsWith('/runtime/moonshine/')),
  async ({ request }) =>
    (await (await caches.open('signemo-moonshine-vi-release-v2')).match(request)) ?? fetch(request),
);
// Optional avatar is fetched only when enabled, then available offline.
registerRoute(
  ({ request, url }) =>
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    (url.pathname === '/avatar/signemo.glb' ||
      /^\/assets\/ExpressionAvatar-[A-Za-z0-9_-]+\.js$/.test(url.pathname)),
  async ({ request }) => {
    const cache = await caches.open('signemo-avatar-v1');
    const saved = await cache.match(request);
    if (saved) return saved;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  },
);
// Only an explicitly selected research adapter writes checksum-verified assets.
registerRoute(
  ({ request, url }) =>
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    /^\/research\/runtime-ort-gpu\/ort-wasm-simd-threaded\.asyncify\.(mjs|wasm)$/.test(
      url.pathname,
    ),
  async ({ request }) => {
    const saved = await (await caches.open('signemo-research-face-runtime-v1')).match(request);
    return saved ?? fetch(request);
  },
);
registerRoute(
  ({ request, url }) =>
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    url.pathname.startsWith('/research/gipformer/'),
  async ({ request, url }) => {
    const cached = await (await caches.open('signemo-research-gipformer-v1')).match(request);
    if (url.pathname.endsWith('/manifest.json')) {
      try {
        const response = await fetch(request, { cache: 'no-store' });
        if (response.ok) return response;
      } catch {
        /* explicit offline research cache */
      }
      return cached ?? new Response('', { status: 404 });
    }
    return cached ?? fetch(request);
  },
);
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
registerRoute(
  ({ request, url }) =>
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    url.pathname === '/models/conversation-manifest.json',
  async ({ request }) => {
    const cache = await caches.open('signemo-conversation-v1');
    try {
      const fresh = await fetch(request, { cache: 'no-store' });
      if (!fresh.ok) throw new Error('Missing packs');
      await cache.put(request, fresh.clone()).catch(() => undefined);
      return fresh;
    } catch {
      const saved = await cache.match(request);
      if (saved) return saved;
      throw new Error('Missing offline packs');
    }
  },
);
async function fetchWithFallback(
  request: Request,
  cacheName: string,
  manifestUrl: string,
  modifyResponse?: (r: Response) => Response,
) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return modifyResponse ? modifyResponse(cached) : cached;

  try {
    const direct = await fetch(request);
    if (direct.ok && !direct.headers.get('content-type')?.includes('text/html')) {
      await cache.put(request, direct.clone()).catch(() => undefined);
      return modifyResponse ? modifyResponse(direct) : direct;
    }
  } catch {}

  // If local host doesn't have the file (e.g. Vercel deployment), look up original source CDN in manifest
  try {
    const manifestResp = (await cache.match(manifestUrl)) ?? (await fetch(manifestUrl));
    if (manifestResp?.ok) {
      const manifest = await manifestResp.clone().json();
      const assets: Array<{ url: string; source?: string }> = manifest.packs
        ? manifest.packs.flatMap(
            (p: { assets?: Array<{ url: string; source?: string }> }) => p.assets ?? [],
          )
        : (manifest.assets ?? []);
      const pathname = new URL(request.url).pathname;
      const match = assets.find((a) => a.url === pathname);
      if (match?.source && /^https?:\/\//.test(match.source)) {
        const cdnResp = await fetch(match.source);
        if (cdnResp.ok) {
          await cache.put(request, cdnResp.clone()).catch(() => undefined);
          return modifyResponse ? modifyResponse(cdnResp) : cdnResp;
        }
      }
    }
  } catch {}

  return fetch(request);
}

registerRoute(
  ({ request, url }) =>
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/models/local/') || url.pathname.startsWith('/runtime/speech/')),
  async ({ request }) => {
    return fetchWithFallback(
      request,
      'signemo-conversation-v1',
      '/models/conversation-manifest.json',
    );
  },
);
registerRoute(
  ({ request, url }) =>
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    url.pathname === '/models/manifest.json',
  async ({ request }) => {
    const cache = await caches.open('signemo-models-v1');
    try {
      const fresh = await fetch(request, { cache: 'no-store' });
      if (!fresh.ok) throw new Error('Manifest unavailable');
      await cache.put(request, fresh.clone()).catch(() => undefined);
      return fresh;
    } catch {
      const saved = await cache.match(request);
      if (saved) return saved;
      throw new Error('Offline manifest missing');
    }
  },
);
registerRoute(
  ({ request, url }) =>
    request.method === 'GET' &&
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/models/') || url.pathname.startsWith('/runtime/')),
  async ({ request }) => {
    return fetchWithFallback(
      request,
      'signemo-models-v1',
      '/models/manifest.json',
      workerCompatible,
    );
  },
);
registerRoute(
  ({ request, url }) => request.mode === 'navigate' && url.origin === self.location.origin,
  async ({ request, url }) => {
    // The local Moonshine research page needs response-level COOP/COEP headers.
    // A precached shell would strip those headers, so fetch only this explicit opt-in URL.
    if (url.searchParams.get('moonshine') === '1') {
      try {
        return await fetch(request);
      } catch {
        const saved = (await matchPrecache('/index.html'))!;
        const headers = new Headers(saved.headers);
        headers.set('Cross-Origin-Opener-Policy', 'same-origin');
        headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
        return new Response(saved.body, { headers });
      }
    }
    return (await matchPrecache('/index.html'))!;
  },
);
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
  if (event.data?.type === 'CHECK_APP_CACHE')
    event.waitUntil(
      (async () => {
        const complete = (
          await Promise.all(
            appAssets.map((asset) => matchPrecache(typeof asset === 'string' ? asset : asset.url)),
          )
        ).every(Boolean);
        event.ports[0]?.postMessage({ complete });
      })(),
    );
});
