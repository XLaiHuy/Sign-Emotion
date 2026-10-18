import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const revision = 'c018fcf96c79c3bd9184f1c9438fe2095c9f1943';
const source = `https://raw.githubusercontent.com/sb-ai-lab/EmotiEffLib/${revision}/models/affectnet_emotions/onnx/enet_b2_8.onnx`;
const target = 'output/research-assets/emotieff-b2';
const checksum = '180a9d4845b59393de4511598a0d1d34b705034691ea32959ce5009db7cf52b7';
await mkdir(target, { recursive: true });
let data;
try {
  data = await readFile(`${target}/enet_b2_8.onnx`);
} catch {
  /* Explicit CLI download only. */
}
if (!data || createHash('sha256').update(data).digest('hex') !== checksum) {
  const response = await fetch(source, { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`B2 HTTP ${response.status}`);
  data = Buffer.from(await response.arrayBuffer());
}
if (data.length !== 30779724 || createHash('sha256').update(data).digest('hex') !== checksum)
  throw new Error('B2 artifact mismatch');
await writeFile(`${target}/enet_b2_8.onnx`, data);
await writeFile(
  `${target}/manifest.json`,
  JSON.stringify(
    {
      profile: 'emotiefflib-enet-b2-8-research-v1',
      researchOnly: true,
      validated: false,
      source,
      revision,
      license: 'Apache-2.0 (upstream repository)',
      bytes: data.length,
      sha256: checksum,
      input: {
        shape: [1, 3, 260, 260],
        type: 'float32',
        preprocessing: 'RGB /255; mean [0.485,0.456,0.406]; std [0.229,0.224,0.225]; NCHW',
      },
      labels: [
        'anger',
        'contempt',
        'disgust',
        'fear',
        'happiness',
        'neutral',
        'sadness',
        'surprise',
      ],
      evaluation: 'Not validated on SignEmo or Android',
    },
    null,
    2,
  ) + '\n',
);
console.log('Pinned B2 research artifact verified; product profile unchanged.');
