import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const manifest = JSON.parse(await readFile('public/models/manifest.json', 'utf8'));
if (
  manifest.version !== 'emotiefflib-enet-b2-8-demo-v1' ||
  manifest.sourceRevision !== 'c018fcf96c79c3bd9184f1c9438fe2095c9f1943' ||
  manifest.input?.type !== 'float32' ||
  JSON.stringify(manifest.input?.shape) !== JSON.stringify([1, 3, 260, 260]) ||
  manifest.labels?.join(',') !== 'anger,contempt,disgust,fear,happiness,neutral,sadness,surprise' ||
  manifest.signemoOutputOrder?.join(',') !==
    'neutral,happy,surprised,sad,angry,disgust,fear,contempt' ||
  manifest.assets?.filter(
    (asset) =>
      asset.url === '/models/enet_b2_8.onnx' &&
      asset.bytes === 30779724 &&
      asset.sha256 === '180a9d4845b59393de4511598a0d1d34b705034691ea32959ce5009db7cf52b7',
  ).length !== 1 ||
  manifest.assets?.some((asset) => asset.url === '/models/emotion-ferplus-12-int8.onnx')
)
  throw new Error('The face model manifest must select the pinned EmotiEffLib profile');
for (const asset of manifest.assets) {
  const data = await readFile(`public${asset.url}`);
  const hash = createHash('sha256').update(data).digest('hex');
  if (hash !== asset.sha256 || data.length !== asset.bytes)
    throw new Error(`Asset mismatch: ${asset.url}`);
  // Docker/Quick Tunnel supports B2's 29.35 MiB file; Pages requires splitting.
  if (process.env.SIGNEMO_HOSTING === 'pages' && data.length > 25 * 1024 * 1024)
    throw new Error(`Cloudflare Pages asset exceeds 25 MiB: ${asset.url}`);
}
const conversation = JSON.parse(await readFile('public/models/conversation-manifest.json', 'utf8'));
const budget = JSON.parse(await readFile('scripts/product-budget.json', 'utf8'));
const selectedAssets = new Map();
for (const asset of [...manifest.assets, ...conversation.packs.flatMap((pack) => pack.assets)]) {
  const previous = selectedAssets.get(asset.url);
  if (previous && (previous.sha256 !== asset.sha256 || previous.bytes !== asset.bytes))
    throw new Error('Conflicting product asset generation');
  if (asset.url.startsWith('/research/'))
    throw new Error('Research assets must not enter product cache');
  selectedAssets.set(asset.url, asset);
}
const selectedBytes = [...selectedAssets.values()].reduce((total, asset) => total + asset.bytes, 0);
if (selectedBytes > budget.baselineBytes + budget.maximumIncreaseBytes)
  throw new Error('Selected product profile exceeds the 100 MiB incremental model/runtime budget');
const lock = JSON.parse(await readFile('scripts/conversation-assets.lock.json', 'utf8'));
const pinned = new Map(lock.assets.map((asset) => [asset.url, asset]));
const phoWhisperAssets = lock.assets.filter((asset) =>
  asset.url.startsWith('/models/local/huuquyet/PhoWhisper-tiny/'),
);
const phoWhisperBytes = phoWhisperAssets.reduce((sum, asset) => sum + asset.bytes, 0);
if (!phoWhisperAssets.length || phoWhisperBytes > 100 * 1024 * 1024)
  throw new Error('PhoWhisper must be pinned and stay within the 100 MiB incremental asset budget');
for (const path of [
  '/models/local/huuquyet/PhoWhisper-tiny/onnx/encoder_model_quantized.onnx',
  '/models/local/huuquyet/PhoWhisper-tiny/onnx/decoder_model_merged_quantized.onnx',
]) {
  if (!phoWhisperAssets.some((asset) => asset.url === path))
    throw new Error(`PhoWhisper q8 graph absent from pinned profile: ${path}`);
}
const speechRuntimeRoot = 'node_modules/@huggingface/transformers/node_modules/onnxruntime-web';
const speechRuntimePackage = JSON.parse(
  await readFile(`${speechRuntimeRoot}/package.json`, 'utf8'),
);
const checked = new Set();
const checkedRuntime = new Set();
for (const pack of conversation.packs) {
  for (const asset of pack.assets) {
    if (checked.has(asset.url) || checkedRuntime.has(asset.url)) continue;
    const expected = pinned.get(asset.url);
    if (expected && (expected.sha256 !== asset.sha256 || expected.bytes !== asset.bytes))
      throw new Error(`Conversation manifest differs from lock: ${asset.url}`);
    const data = await readFile(`public${asset.url}`);
    if (
      data.length !== asset.bytes ||
      createHash('sha256').update(data).digest('hex') !== asset.sha256
    )
      throw new Error(`Conversation asset mismatch: ${asset.url}`);
    if (asset.url.startsWith('/runtime/speech/')) {
      const filename = asset.url.slice('/runtime/speech/'.length);
      const upstreamPath = `${speechRuntimeRoot}/dist/${filename}`;
      const upstream = await readFile(upstreamPath);
      if (
        !/^ort-wasm-simd-threaded\.jsep\.(mjs|wasm)$/.test(filename) ||
        asset.source !== `onnxruntime-web@${speechRuntimePackage.version}/dist/${filename}` ||
        !upstream.equals(data)
      )
        throw new Error(`Speech runtime is not from the installed pinned package: ${asset.url}`);
      checkedRuntime.add(asset.url);
    } else {
      if (!expected) throw new Error(`Conversation asset is not pinned: ${asset.url}`);
      checked.add(asset.url);
    }
  }
}
if (
  checkedRuntime.size !== 2 ||
  !checkedRuntime.has('/runtime/speech/ort-wasm-simd-threaded.jsep.mjs') ||
  !checkedRuntime.has('/runtime/speech/ort-wasm-simd-threaded.jsep.wasm')
)
  throw new Error('Both pinned speech runtime assets are required');
for (const id of ['speech', 'emotion']) {
  if (!conversation.packs.some((pack) => pack.id === id && pack.assets.length))
    throw new Error(`Required pack absent: ${id}`);
}
if (checked.size !== lock.assets.length)
  throw new Error('Unexpected, unpinned, or obsolete conversation assets in product manifest');
if (checked.size !== new Set(lock.assets.map((asset) => asset.url)).size)
  throw new Error('Duplicate conversation asset URLs in lock');
if (conversation.packs.some((pack) => pack.id === 'speech-base'))
  throw new Error('Whisper base must not be part of the product profile');
if (
  conversation.packs.some((pack) =>
    pack.assets.some((asset) => asset.url.includes('Speech-Emotion-Classification-ONNX')),
  )
)
  throw new Error('Speech emotion model must not be part of the product profile');
for (const asset of lock.assets) {
  if (!checked.has(asset.url)) throw new Error(`Required conversation asset absent: ${asset.url}`);
}
console.log(`${manifest.assets.length} face assets + ${checked.size} conversation assets verified`);
