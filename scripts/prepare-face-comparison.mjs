import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import './prepare-b2.mjs';
const root = 'output/research-assets';
const revision = 'c018fcf96c79c3bd9184f1c9438fe2095c9f1943';
const sha256 = '7aa2ea31c1311f4f8aa9d3fdb085d418dd4e7a48c4b9ed41df8c044f91d0213f';
const name = 'enet_b0_8_best_afew.onnx';
const target = `${root}/emotieff-b0/${name}`;
const source = `https://raw.githubusercontent.com/sb-ai-lab/EmotiEffLib/${revision}/models/affectnet_emotions/onnx/${name}`;
await mkdir(`${root}/emotieff-b0`, { recursive: true });
let bytes;
try {
  bytes = await readFile(target);
} catch {
  /* explicit preparation only */
}
const hash = (data) => createHash('sha256').update(data).digest('hex');
if (!bytes || hash(bytes) !== sha256) {
  const response = await fetch(source, { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`B0 HTTP ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
}
if (bytes.length !== 16039595 || hash(bytes) !== sha256) throw new Error('B0 checksum mismatch');
await writeFile(target, bytes);
await mkdir(`${root}/runtime-ort-gpu`, { recursive: true });
const version = JSON.parse(
  await readFile('node_modules/onnxruntime-web/package.json', 'utf8'),
).version;
if (version !== '1.30.0') throw new Error('Review GPU runtime version before preparing');
const runtime = [];
for (const file of [
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
]) {
  await copyFile(`node_modules/onnxruntime-web/dist/${file}`, `${root}/runtime-ort-gpu/${file}`);
  const data = await readFile(`${root}/runtime-ort-gpu/${file}`);
  runtime.push({ file, bytes: data.length, sha256: hash(data) });
}
await writeFile(
  `${root}/face-comparison-manifest.json`,
  JSON.stringify(
    {
      experimental: true,
      validated: false,
      source,
      revision,
      license: 'Apache-2.0; EmotiEffLib upstream',
      b0: { bytes: bytes.length, sha256, size: 224 },
      profiles: ['b0-wasm-research', 'b0-webgpu-research', 'b2-webgpu-research'],
      runtime: { package: 'onnxruntime-web', version, files: runtime },
    },
    null,
    2,
  ) + '\n',
);
console.log('Research B0/B2 and matching GPU runtime verified; product profile unchanged.');
