import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Publish only manifest-listed public artifacts at their exact digest URLs. */
export async function packageVercelAssets(directory = 'dist') {
  const root = resolve(directory);
  const manifest = JSON.parse(await readFile(resolve(root, 'models/manifest.json'), 'utf8'));
  const conversation = JSON.parse(
    await readFile(resolve(root, 'models/conversation-manifest.json'), 'utf8'),
  );
  const assets = [...manifest.assets, ...conversation.packs.flatMap((pack) => pack.assets)];
  for (const asset of assets) {
    if (
      !/^\/(models|runtime)(\/[A-Za-z0-9_.-]+)+$/.test(asset.url) ||
      /\/(\.|\.\.)(\/|$)/.test(asset.url) ||
      !/^[a-f0-9]{64}$/.test(asset.sha256)
    )
      throw new Error('Invalid public asset path or digest');
    const source = resolve(root, '.' + asset.url);
    const digest = createHash('sha256');
    let bytes = 0;
    for await (const chunk of createReadStream(source)) {
      digest.update(chunk);
      bytes += chunk.length;
    }
    if (bytes !== asset.bytes || digest.digest('hex') !== asset.sha256)
      throw new Error(`Deployment asset mismatch: ${asset.url}`);
    const target = resolve(root, 'immutable', asset.sha256, '.' + asset.url);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  }
  return assets.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  console.log(`Packaged ${await packageVercelAssets()} checksum-addressed Vercel assets`);
