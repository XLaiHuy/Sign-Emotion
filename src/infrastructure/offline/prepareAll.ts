import {
  checkOfflineReady,
  loadManifest,
  prepareOffline,
  modelAssetsReady,
  ensureOfflineApp,
  ensureServiceWorkerController,
} from './assets';
import { loadPacks, packReady, preparePack } from './packs';
import { conversationProfile } from '../inference/conversationProfile';
import {
  candidateAssetBytes,
  candidateAssetsReady,
  prepareCandidateAssets,
} from './candidateAssets';

export interface PreparationProgress {
  label: string;
  done: number;
  total: number;
}

export async function coreModelsReady() {
  const packs = await loadPacks();
  const speech = packs.find((pack) => pack.id === 'speech');
  const appReady = await modelAssetsReady();
  return Boolean(
    speech &&
    appReady &&
    (await packReady(speech)) &&
    (conversationProfile().id !== 'pc-candidate' || (await candidateAssetsReady())),
  );
}

export async function allModelsReady() {
  if (import.meta.env.DEV) return false;
  const [appReady, packs] = await Promise.all([checkOfflineReady(), loadPacks()]);
  if (
    !['speech', 'emotion'].every((id) => packs.some((pack) => pack.id === id && pack.assets.length))
  )
    return false;
  return (
    appReady &&
    (await Promise.all(packs.map(packReady))).every(Boolean) &&
    (conversationProfile().id !== 'pc-candidate' || (await candidateAssetsReady()))
  );
}

export async function prepareAllModels(
  onProgress: (progress: PreparationProgress) => void,
  onCoreReady: () => void | Promise<void>,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const [manifest, packs] = await Promise.all([loadManifest(signal), loadPacks(signal)]);
  const appBytes = manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0);
  const speechPack = packs.find((pack) => pack.id === 'speech');
  const speechBytes = speechPack
    ? speechPack.assets.reduce((sum, asset) => sum + asset.bytes, 0)
    : 0;
  const packBytes = packs.reduce(
    (sum, pack) => sum + pack.assets.reduce((packSum, asset) => packSum + asset.bytes, 0),
    0,
  );
  const candidateBytes = conversationProfile().id === 'pc-candidate' ? candidateAssetBytes : 0;
  const coreTotal = appBytes + speechBytes + candidateBytes;
  const total = appBytes + packBytes + candidateBytes;
  let offset = 0;

  await prepareOffline(
    (label, done) =>
      onProgress({ label: `Ứng dụng · ${label}`, done: Math.min(coreTotal, done), total: coreTotal }),
    signal,
    true,
  );
  offset = appBytes;

  const ordered = [...packs].sort((a, b) => Number(a.id !== 'speech') - Number(b.id !== 'speech'));
  for (const pack of ordered) {
    signal?.throwIfAborted();
    const bytes = pack.assets.reduce((sum, asset) => sum + asset.bytes, 0);
    const isCoreSpeech = pack.id === 'speech';
    await preparePack(
      pack,
      (done) =>
        onProgress(
          isCoreSpeech
            ? {
                label: labelFor(pack.id),
                done: Math.min(coreTotal, offset + done),
                total: coreTotal,
              }
            : {
                label: `${labelFor(pack.id)} (tải nền)`,
                done,
                total: bytes,
              },
        ),
      signal,
    );
    offset += bytes;
    if (isCoreSpeech) {
      if (candidateBytes) {
        await prepareCandidateAssets(
          (done) =>
            onProgress({
              label: 'Phụ đề và khuôn mặt · đang tải và kiểm tra',
              done: Math.min(coreTotal, offset + done),
              total: coreTotal,
            }),
          signal,
        );
        offset += candidateBytes;
      }
      if (!import.meta.env.DEV && 'serviceWorker' in navigator) {
        try {
          await ensureServiceWorkerController(signal);
        } catch (err) {
          if (signal?.aborted) throw err;
          /* allow core ready to proceed if SW activation takes longer */
        }
      }
      signal?.throwIfAborted();
      await onCoreReady();
    }
  }

  if (import.meta.env.DEV) return false;
  await ensureOfflineApp(signal);
  // Optional packages can evict an earlier CacheStorage entry on browsers
  // with a tight per-origin quota. Repair only packages that actually lost
  // assets, once, after the full download pass.
  for (const pack of packs) {
    signal?.throwIfAborted();
    if (await packReady(pack)) continue;
    await preparePack(
      pack,
      () => onProgress({ label: `${labelFor(pack.id)} · kiểm tra lại`, done: total, total }),
      signal,
    );
  }
  if (!(await allModelsReady())) throw new Error('Chưa xác minh đủ model và ứng dụng offline.');
  return true;
}

function labelFor(id: string) {
  switch (id) {
    case 'speech':
      return 'phụ đề';
    case 'emotion':
      return 'gợi ý kết hợp';
    default:
      return 'model';
  }
}
