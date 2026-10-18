import { beforeEach, expect, it, vi } from 'vitest';
import { coreModelsReady, prepareAllModels } from '../src/infrastructure/offline/prepareAll';
import {
  checkOfflineReady,
  modelAssetsReady,
  prepareOffline,
} from '../src/infrastructure/offline/assets';
import { preparePack } from '../src/infrastructure/offline/packs';
import { prepareCandidateAssets } from '../src/infrastructure/offline/candidateAssets';
vi.mock('../src/infrastructure/offline/candidateAssets', () => ({
  candidateAssetBytes: 40,
  candidateAssetsReady: vi.fn(async () => true),
  prepareCandidateAssets: vi.fn(async () => {}),
}));

vi.mock('../src/infrastructure/offline/assets', () => ({
  checkOfflineReady: vi.fn(async () => false),
  modelAssetsReady: vi.fn(async () => true),
  prepareOffline: vi.fn(async () => {}),
  ensureOfflineApp: vi.fn(async () => {}),
  loadManifest: vi.fn(async () => ({ assets: [{ bytes: 10 }] })),
}));
vi.mock('../src/infrastructure/offline/packs', () => ({
  loadPacks: vi.fn(async () => [
    { id: 'emotion', assets: [{ bytes: 20 }] },
    { id: 'speech', assets: [{ bytes: 30 }] },
  ]),
  packReady: vi.fn(async () => true),
  preparePack: vi.fn(async () => {}),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(modelAssetsReady).mockResolvedValue(true);
});
it('finishes candidate downloads before starting any core worker and before optional text', async () => {
  vi.stubEnv('VITE_AI_PROFILE', 'pc-candidate');
  vi.mocked(preparePack).mockImplementation(async () => {});
  let release!: () => void;
  vi.mocked(prepareCandidateAssets).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const core = vi.fn();
  try {
    const task = prepareAllModels(vi.fn(), core);
    await vi.waitFor(() => expect(prepareCandidateAssets).toHaveBeenCalledOnce());
    expect(core).not.toHaveBeenCalled();
    expect(vi.mocked(preparePack).mock.calls.map(([pack]) => pack.id)).toEqual(['speech']);
    release();
    await task;
    expect(core).toHaveBeenCalledOnce();
  } finally {
    vi.unstubAllEnvs();
  }
});
it('allows core inference without a service worker or complete offline app', async () => {
  await expect(coreModelsReady()).resolves.toBe(true);
  expect(checkOfflineReady).not.toHaveBeenCalled();
  vi.mocked(modelAssetsReady).mockResolvedValue(false);
  await expect(coreModelsReady()).resolves.toBe(false);
});
it('prepares core assets first and reports core ready before an optional pack fails', async () => {
  const coreReady = vi.fn();
  vi.mocked(preparePack).mockImplementation(async (pack) => {
    if (pack.id === 'emotion') throw new Error('optional download failed');
  });
  await expect(prepareAllModels(vi.fn(), coreReady)).rejects.toThrow('optional download failed');
  expect(prepareOffline).toHaveBeenCalledWith(expect.any(Function), undefined, true);
  expect(vi.mocked(preparePack).mock.calls.map(([pack]) => pack.id)).toEqual(['speech', 'emotion']);
  expect(coreReady).toHaveBeenCalledTimes(1);
});

it('waits for the shared core owner before preparing optional assets', async () => {
  vi.mocked(preparePack).mockImplementation(async () => {});
  let finish!: () => void;
  const initialized = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const core = vi.fn(() => initialized);
  const task = prepareAllModels(vi.fn(), core);
  await vi.waitFor(() => expect(core).toHaveBeenCalledOnce());
  expect(vi.mocked(preparePack).mock.calls.map(([pack]) => pack.id)).toEqual(['speech']);
  finish();
  await task;
  expect(vi.mocked(preparePack).mock.calls.map(([pack]) => pack.id)).toEqual(['speech', 'emotion']);
});
