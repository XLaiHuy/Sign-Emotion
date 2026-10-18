import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const root = 'output/research-assets/moonshine-built';
const profiles = {};
const modelBytes = JSON.parse(
  readFileSync('scripts/moonshine-streaming-vi.lock.json', 'utf8'),
).assets.reduce((sum, asset) => sum + asset.bytes, 0);
for (const id of ['single', 'two']) {
  profiles[id] = {
    source: 'https://github.com/moonshine-ai/moonshine',
    commit: '234f60faa0eb388b01cdf7e60aca232af37aefda',
    emscripten: '4.0.8',
    ort: '1.23.2',
    ortCommit: readFileSync(root + '/ort-revision.txt', 'utf8').trim(),
    license: 'MIT',
    computeThreads: id === 'single' ? 1 : 2,
    requiresIsolation: id !== 'single',
    patchSha256: hash(readFileSync(root + '/two-thread.patch')),
    assets: [
      'moonshine.mjs',
      'moonshine.wasm',
      'LICENSE',
      'ONNXRUNTIME-LICENSE',
      'ONNXRUNTIME-THIRD-PARTY-NOTICES',
    ].map((file) => {
      const bytes = readFileSync(`${root}/${id}/${file}`);
      if (file.endsWith('.wasm') && bytes.subarray(0, 4).toString('hex') !== '0061736d')
        throw new Error('Built WASM artifact is missing or still an LFS pointer');
      return { file, bytes: bytes.length, sha256: hash(bytes) };
    }),
  };
  profiles[id].totalModelRuntimeBytes =
    modelBytes + profiles[id].assets.reduce((sum, asset) => sum + asset.bytes, 0);
  if (profiles[id].totalModelRuntimeBytes > 100 * 1024 * 1024)
    throw new Error('Built runtime exceeds research profile download budget');
}
writeFileSync(
  'scripts/moonshine-runtime-profiles.lock.json',
  JSON.stringify(profiles, null, 2) + '\n',
);
console.log(
  'Pinned two locally built runtimes. Parity/browser gates still required before selection.',
);
