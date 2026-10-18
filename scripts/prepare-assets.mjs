import { mkdir, readFile, writeFile, copyFile, readdir, stat, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const assets = [];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pinnedModels = {
  'models/enet_b2_8.onnx': '180a9d4845b59393de4511598a0d1d34b705034691ea32959ce5009db7cf52b7',
  'models/face_landmarker.task': '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff',
};
async function download(url, relative, license) {
  const target = resolve(root, 'public', relative);
  await mkdir(dirname(target), { recursive: true });
  let data;
  try {
    data = await readFile(target);
    if (data.length < 1000 || data.subarray(0, 100).toString().includes('git-lfs')) data = null;
  } catch {}
  if (!data) {
    console.log(`Download ${relative}`);
    const response = await fetch(url, { signal: AbortSignal.timeout(180_000) });
    if (!response.ok) throw new Error(`${relative}: HTTP ${response.status}`);
    data = Buffer.from(await response.arrayBuffer());
    if (data.length < 1000) throw new Error(`Invalid asset: ${relative}`);
    await writeFile(target, data);
  }
  if (hash(data) !== pinnedModels[relative])
    throw new Error(
      `Unexpected model checksum: ${relative}. Review source/license and version before updating the pinned hash.`,
    );
  assets.push({
    url: `/${relative}`,
    bytes: data.length,
    sha256: hash(data),
    source: url,
    license,
  });
}
await download(
  'https://raw.githubusercontent.com/sb-ai-lab/EmotiEffLib/c018fcf96c79c3bd9184f1c9438fe2095c9f1943/models/affectnet_emotions/onnx/enet_b2_8.onnx',
  'models/enet_b2_8.onnx',
  'Apache-2.0 — EmotiEffLib',
);
await download(
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  'models/face_landmarker.task',
  'Apache-2.0 — MediaPipe',
);
for (const [pkg, sourceDir, targetDir] of [
  ['@mediapipe/tasks-vision', 'wasm', 'runtime/mediapipe'],
  ['onnxruntime-web', 'dist', 'runtime/ort'],
]) {
  const location = resolve(root, 'node_modules', pkg, sourceDir);
  const info = JSON.parse(
    await readFile(resolve(root, 'node_modules', pkg, 'package.json'), 'utf8'),
  );
  await mkdir(resolve(root, 'public', targetDir), { recursive: true });
  for (const file of await readdir(location)) {
    if (
      pkg === 'onnxruntime-web'
        ? !/^ort-wasm-simd-threaded\.(wasm|mjs)$/.test(file)
        : !/\.(wasm|js)$/.test(file)
    )
      continue;
    const target = resolve(root, 'public', targetDir, file);
    await copyFile(resolve(location, file), target);
    const data = await readFile(target);
    assets.push({
      url: `/${targetDir}/${file}`,
      bytes: data.length,
      sha256: hash(data),
      source: `${pkg}@${info.version}/${sourceDir}/${file}`,
      license: pkg === 'onnxruntime-web' ? 'MIT' : 'Apache-2.0',
    });
    if (pkg === '@mediapipe/tasks-vision' && file.endsWith('.js')) {
      const moduleFile = file.replace(/\.js$/, '.mjs');
      // ESM is strict: the upstream block-scoped function relies on Annex B
      // sloppy-script hoisting. Preserve its intended function scope explicitly.
      const esmSource = data
        .toString('utf8')
        .replace('function custom_dbg(text) {', 'var custom_dbg = function(text) {');
      const moduleData = Buffer.from(`${esmSource}\nexport default ModuleFactory;\n`);
      await writeFile(resolve(root, 'public', targetDir, moduleFile), moduleData);
      assets.push({
        url: `/${targetDir}/${moduleFile}`,
        bytes: moduleData.length,
        sha256: hash(moduleData),
        source: `${pkg}@${info.version}/${sourceDir}/${file} + ESM wrapper and strict-mode debug scope compatibility`,
        license: 'Apache-2.0',
      });
    }
  }
}
const manifest = {
  version: 'emotiefflib-enet-b2-8-demo-v1',
  assets,
  input: {
    shape: [1, 3, 260, 260],
    type: 'float32',
    preprocessing:
      'Roll-aligned RGB face crop; resize 260x260; scale RGB to 0..1; ImageNet mean [0.485,0.456,0.406], std [0.229,0.224,0.225]; NCHW. Experimental demo profile, not accuracy validated.',
  },
  labels: ['anger', 'contempt', 'disgust', 'fear', 'happiness', 'neutral', 'sadness', 'surprise'],
  signemoOutputOrder: [
    'neutral',
    'happy',
    'surprised',
    'sad',
    'angry',
    'disgust',
    'fear',
    'contempt',
  ],
  sourceRevision: 'c018fcf96c79c3bd9184f1c9438fe2095c9f1943',
};
await writeFile(
  resolve(root, 'public/models/manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
// Generated B0 is no longer selected; keep it out of the production image.
await rm(resolve(root, 'public/models/enet_b0_8_best_afew.onnx'), { force: true });
// Preserve upstream license texts alongside redistributed models/runtime.
await mkdir(resolve(root, 'public/licenses'), { recursive: true });
for (const [name, source] of [
  ['onnx-models-Apache-2.0.txt', 'https://raw.githubusercontent.com/onnx/models/main/LICENSE'],
  ['ferplus-MIT.txt', 'https://raw.githubusercontent.com/microsoft/FERPlus/master/LICENSE.md'],
  [
    'emotiefflib-Apache-2.0.txt',
    'https://raw.githubusercontent.com/sb-ai-lab/EmotiEffLib/c018fcf96c79c3bd9184f1c9438fe2095c9f1943/LICENSE',
  ],
  [
    'mediapipe-Apache-2.0.txt',
    'https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/LICENSE',
  ],
  ['onnxruntime-MIT.txt', 'https://raw.githubusercontent.com/microsoft/onnxruntime/main/LICENSE'],
]) {
  const target = resolve(root, 'public/licenses', name);
  try {
    await stat(target);
  } catch {
    const response = await fetch(source, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`License download failed: ${name}`);
    await writeFile(target, await response.text());
  }
}
// Generate actual PNG icons without installing an image editing tool.
const { deflateSync } = await import('node:zlib');
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}
for (const size of [192, 512]) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const bars = [0.11, 0.28, 0.44, 0.28, 0.11];
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4;
      let lit = false;
      for (let b = 0; b < 5; b++) {
        const cx = size * (0.29 + b * 0.105);
        if (Math.abs(x - cx) < size * 0.028 && Math.abs(y - size / 2) < (size * bars[b]) / 2)
          lit = true;
      }
      raw[i] = lit ? 255 : 23;
      raw[i + 1] = lit ? 255 : 109;
      raw[i + 2] = lit ? 255 : 87;
      raw[i + 3] = 255;
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  await writeFile(
    resolve(root, `public/icon-${size}.png`),
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}
console.log(
  `Prepared ${assets.length} verified assets (${(assets.reduce((s, a) => s + a.bytes, 0) / 1024 / 1024).toFixed(1)} MiB)`,
);
