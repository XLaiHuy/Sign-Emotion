import { afterEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { packageVercelAssets } from '../scripts/package-vercel-assets.mjs';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (!resolve(root).startsWith(join(resolve(tmpdir()), 'signemo-vercel-')))
      throw new Error('Unexpected test directory');
    await rm(root, { recursive: true, force: true });
  }
});
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'signemo-vercel-'));
  roots.push(root);
  await mkdir(join(root, 'models'));
  const data = Buffer.from([1, 2, 3, 4]);
  const asset = {
    url: '/models/model.onnx',
    bytes: data.length,
    sha256: createHash('sha256').update(data).digest('hex'),
  };
  await writeFile(join(root, 'models/model.onnx'), data);
  await writeFile(join(root, 'models/manifest.json'), JSON.stringify({ assets: [asset] }));
  await writeFile(join(root, 'models/conversation-manifest.json'), JSON.stringify({ packs: [] }));
  return { root, asset, data };
}
it('serves exact digest paths while preserving worker/cache paths', async () => {
  const { root, asset, data } = await fixture();
  expect(await packageVercelAssets(root)).toBe(1);
  expect(await readFile(join(root, 'immutable', asset.sha256, 'models/model.onnx'))).toEqual(data);
  expect(await readFile(join(root, 'models/model.onnx'))).toEqual(data);
});
it.each(['missing', 'corrupt'])('rejects a %s deployment asset', async (mode) => {
  const { root } = await fixture();
  const file = join(root, 'models/model.onnx');
  if (mode === 'missing') await rm(file);
  else await writeFile(file, Buffer.from([4, 3, 2, 1]));
  await expect(packageVercelAssets(root)).rejects.toThrow();
});
it('rejects paths outside the public model/runtime allowlist', async () => {
  const { root, asset } = await fixture();
  await writeFile(
    join(root, 'models/manifest.json'),
    JSON.stringify({ assets: [{ ...asset, url: '/models/../../secret' }] }),
  );
  await expect(packageVercelAssets(root)).rejects.toThrow('Invalid public asset');
});
