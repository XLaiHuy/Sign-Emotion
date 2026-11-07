import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyAsset, ASSET_CACHE } from '../src/infrastructure/offline/assets';
beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('offline integrity', () => {
  it('accepts exact bytes and rejects truncated or corrupted assets', async () => {
    const asset = {
      url: '/models/test.onnx',
      bytes: 3,
      sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      source: 'test',
      license: 'test',
    };
    expect((await verifyAsset(new Response('abc'), asset)).byteLength).toBe(3);
    await expect(verifyAsset(new Response('ab'), asset)).rejects.toThrow('đầy đủ');
    await expect(verifyAsset(new Response('abd'), asset)).rejects.toThrow('checksum');
  });
  it('requires app shell, model integrity, and an active controlling worker', async () => {
    const { checkOfflineReady } = await import('../src/infrastructure/offline/assets');
    const asset = {
      url: '/models/test.onnx',
      bytes: 3,
      sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      source: 'test',
      license: 'test',
    };
    const manifest = { assets: [asset] };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(manifest))),
    );
    let app = false;
    vi.stubGlobal(
      'MessageChannel',
      class {
        port1 = { onmessage: null as null | ((e: { data: unknown }) => void), close: () => {} };
        port2 = { send: (data: unknown) => this.port1.onmessage?.({ data }), close: () => {} };
      },
    );
    vi.stubGlobal('caches', {
      keys: async () => [ASSET_CACHE, 'app-shell'],
      open: async (name: string) => ({
        match: async () =>
          name === ASSET_CACHE ? new Response('abc') : app ? new Response('<html/>') : undefined,
        delete: vi.fn(),
        put: vi.fn(),
      }),
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        controller: {
          postMessage: (_message: unknown, ports: { send: (data: unknown) => void }[]) =>
            ports[0].send({ complete: app }),
        },
        getRegistration: async () => ({ active: {} }),
      },
      configurable: true,
    });
    expect(await checkOfflineReady()).toBe(false);
    app = true;
    expect(await checkOfflineReady()).toBe(true);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { controller: null, getRegistration: async () => ({ active: {} }) },
      configurable: true,
    });
    expect(await checkOfflineReady()).toBe(false);
  });
  it('cancels streamed downloads without caching an incomplete asset', async () => {
    const { prepareOffline } = await import('../src/infrastructure/offline/assets');
    vi.stubEnv('DEV', false);
    const controller = new AbortController();
    const put = vi.fn();
    const asset = {
      url: '/models/test.onnx',
      bytes: 3,
      sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      source: 'test',
      license: 'test',
    };
    vi.stubGlobal('caches', { open: async () => ({ match: async () => undefined, put }) });
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('.json')
          ? new Response(JSON.stringify({ assets: [asset] }))
          : new Response('abc'),
      ),
    );
    await expect(
      prepareOffline((_label, done) => {
        if (done > 0) controller.abort();
      }, controller.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(put.mock.calls.map(([url]) => url)).toEqual(['/models/manifest.json']);
  });

  describe('ensureServiceWorkerController', () => {
    it('returns immediately if serviceWorker is not supported in navigator', async () => {
      const { ensureServiceWorkerController } = await import(
        '../src/infrastructure/offline/assets'
      );
      const original = (navigator as { serviceWorker?: unknown }).serviceWorker;
      try {
        delete (navigator as { serviceWorker?: unknown }).serviceWorker;
        await expect(ensureServiceWorkerController()).resolves.toBeUndefined();
      } finally {
        Object.defineProperty(navigator, 'serviceWorker', {
          value: original,
          configurable: true,
        });
      }
    });

    it('resolves immediately when controller is already present', async () => {
      const { ensureServiceWorkerController } = await import(
        '../src/infrastructure/offline/assets'
      );
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          ready: Promise.resolve({}),
          controller: {},
        },
        configurable: true,
      });
      await expect(ensureServiceWorkerController()).resolves.toBeUndefined();
    });

    it('waits for controllerchange and cleans up listener when controller becomes active', async () => {
      const { ensureServiceWorkerController } = await import(
        '../src/infrastructure/offline/assets'
      );
      const listeners = new Map<string, Set<EventListener>>();
      const swMock = {
        ready: Promise.resolve({}),
        controller: null as object | null,
        addEventListener: vi.fn((type: string, listener: EventListener) => {
          if (!listeners.has(type)) listeners.set(type, new Set());
          listeners.get(type)!.add(listener);
        }),
        removeEventListener: vi.fn((type: string, listener: EventListener) => {
          listeners.get(type)?.delete(listener);
        }),
      };
      Object.defineProperty(navigator, 'serviceWorker', {
        value: swMock,
        configurable: true,
      });

      const promise = ensureServiceWorkerController();
      await vi.waitFor(() => {
        expect(swMock.addEventListener).toHaveBeenCalledWith(
          'controllerchange',
          expect.any(Function),
          { once: true },
        );
      });

      // Now controller attaches
      swMock.controller = {};
      listeners.get('controllerchange')?.forEach((l) => l(new Event('controllerchange')));

      await expect(promise).resolves.toBeUndefined();
      expect(swMock.removeEventListener).toHaveBeenCalledWith(
        'controllerchange',
        expect.any(Function),
      );
    });

    it('aborts and cleans up listener when abort signal is triggered', async () => {
      const { ensureServiceWorkerController } = await import(
        '../src/infrastructure/offline/assets'
      );
      const swMock = {
        ready: Promise.resolve({}),
        controller: null as object | null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      Object.defineProperty(navigator, 'serviceWorker', {
        value: swMock,
        configurable: true,
      });

      const abort = new AbortController();
      const promise = ensureServiceWorkerController(abort.signal);
      await vi.waitFor(() => {
        expect(swMock.addEventListener).toHaveBeenCalledWith(
          'controllerchange',
          expect.any(Function),
          { once: true },
        );
      });
      abort.abort();

      await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
      expect(swMock.removeEventListener).toHaveBeenCalledWith(
        'controllerchange',
        expect.any(Function),
      );
    });
  });
});

