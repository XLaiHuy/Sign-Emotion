import { readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Only touch generated output. Baseline source assets remain available for rollback. */
export async function pruneCandidateBundle(root, profile) {
  if (profile !== 'pc-candidate') return false;
  const directory = resolve(root);
  const manifestPath = resolve(directory, 'models/manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.assets)) throw new Error('Invalid generated core manifest');
  manifest.assets = manifest.assets.filter((asset) => asset.url !== '/models/enet_b2_8.onnx');
  manifest.bundleProfile = 'pc-candidate-b0-only-v1';
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  // Fixed leaf path, never a recursive delete or a path from manifest input.
  await rm(resolve(directory, 'models/enet_b2_8.onnx'), { force: true });
  return true;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (await pruneCandidateBundle('dist', process.env.VITE_AI_PROFILE))
    console.log('Candidate bundle: removed B2 checkpoint and core cache entry.');
}
