import { mkdtemp, mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { selectedCoreAssets } from '../src/infrastructure/inference/conversationProfile';

it('removes B2 only from generated candidate output, leaving baseline and other files intact', async () => {
  // Import the exact CLI implementation used by Docker, not a duplicated test implementation.
  const { pruneCandidateBundle } = await import('../scripts/prune-candidate-bundle.mjs');
  const root = await mkdtemp(join(tmpdir(), 'signemo-bundle-'));
  try {
    await mkdir(join(root, 'models'));
    const assets = [{ url: '/models/enet_b2_8.onnx' }, { url: '/models/face_landmarker.task' }];
    await writeFile(join(root, 'models/manifest.json'), JSON.stringify({ assets }));
    await writeFile(join(root, 'models/enet_b2_8.onnx'), 'fixture');
    await writeFile(join(root, 'models/face_landmarker.task'), 'detector');
    expect(await pruneCandidateBundle(root, 'baseline')).toBe(false);
    await expect(access(join(root, 'models/enet_b2_8.onnx'))).resolves.toBeUndefined();
    expect(selectedCoreAssets(assets, 'baseline')).toEqual(assets);
    await pruneCandidateBundle(root, 'pc-candidate');
    await expect(access(join(root, 'models/enet_b2_8.onnx'))).rejects.toThrow();
    expect(JSON.parse(await readFile(join(root, 'models/manifest.json'), 'utf8')).assets).toEqual([
      assets[1],
    ]);
    expect(await readFile(join(root, 'models/face_landmarker.task'), 'utf8')).toBe('detector');
    expect(selectedCoreAssets(assets, 'pc-candidate')).toEqual([assets[1]]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
