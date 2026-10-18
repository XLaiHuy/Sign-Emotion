import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPacks, PACK_CACHE } from '../src/infrastructure/offline/packs';
import { ASSET_CACHE, loadManifest } from '../src/infrastructure/offline/assets';
import { settingsSchema } from '../src/shared/contracts';

afterEach(() => vi.unstubAllGlobals());

describe('conversation model manifest', () => {
  it('uses the verified local manifest when the network is unavailable', async () => {
    const asset = (url: string) => ({
      url,
      bytes: 12,
      sha256: 'a'.repeat(64),
      source: 'locked local artifact',
      license: 'MIT',
    });
    const manifest = {
      version: 'conversation-v1',
      packs: [
        { id: 'speech', experimental: false, assets: [asset('/runtime/speech/vad.onnx')] },
        {
          id: 'emotion',
          experimental: true,
          assets: [
            asset('/models/local/phobert/model.onnx'),
            asset('/models/local/onnx-community/Speech-Emotion-Classification-ONNX/model.onnx'),
          ],
        },
        {
          id: 'speech-base',
          experimental: true,
          assets: [asset('/models/local/onnx-community/whisper-base/model.onnx')],
        },
      ],
    };
    const cache = {
      match: vi.fn().mockResolvedValue(
        new Response(JSON.stringify(manifest), {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
      keys: vi.fn().mockResolvedValue([]),
    };
    vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue(cache) });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    await expect(loadPacks()).resolves.toEqual([
      manifest.packs[0],
      { ...manifest.packs[1], assets: [manifest.packs[1].assets[0]] },
    ]);
    expect(caches.open).toHaveBeenCalledWith(PACK_CACHE);
    expect(cache.match).toHaveBeenCalledWith('/models/conversation-manifest.json');
  });

  it('defaults missing audio preferences to muted and preserves explicitly saved audio', () => {
    const legacy = {
      threshold: 0.65,
      dwellMs: 500,
      cooldownMs: 3000,
      haptics: true,
      hapticMode: 'auto',
    };

    expect(settingsSchema.parse(legacy).soundFeedback).toBe(false);
    expect(settingsSchema.parse({ ...legacy, soundFeedback: true }).soundFeedback).toBe(true);
    expect(settingsSchema.parse(legacy).signLanguageCues).toBe(true);
  });

  it('reads the cached face model manifest after the device goes offline', async () => {
    const manifest = {
      version: 'face-v1',
      assets: [
        {
          url: '/models/face-expression.onnx',
          bytes: 12,
          sha256: 'a'.repeat(64),
          source: 'locked local artifact',
          license: 'MIT',
        },
      ],
      input: { shape: [1, 1, 64, 64], type: 'float32', preprocessing: 'grayscale' },
      labels: ['neutral'],
    };
    const cache = {
      match: vi.fn().mockResolvedValue(new Response(JSON.stringify(manifest))),
    };
    vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue(cache) });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    await expect(loadManifest()).resolves.toEqual(manifest);
    expect(caches.open).toHaveBeenCalledWith(ASSET_CACHE);
    expect(cache.match).toHaveBeenCalledWith('/models/manifest.json');
  });
});
