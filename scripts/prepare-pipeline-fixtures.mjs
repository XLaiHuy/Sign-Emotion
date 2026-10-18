import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const destination = 'output/research-assets/benchmark';
const source =
  'https://raw.githubusercontent.com/scikit-image/scikit-image/v0.25.2/skimage/data/astronaut.png';
const expected = '88431cd9653ccd539741b555fb0a46b61558b301d4110412b5bc28b5e3ea6cb5';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const evaluation = JSON.parse(
  (await readFile('output/research-assets/evaluation/manifest.json', 'utf8')).replace(
    /^\uFEFF/,
    '',
  ),
);
const sample = evaluation.samples.find((row) => row.id === 1594);
if (
  evaluation.dataset !== 'google/fleurs' ||
  evaluation.license !== 'CC-BY-4.0' ||
  sample?.url !== '/research/evaluation/0.f32'
)
  throw new Error(
    'Prepare the public FLEURS Vietnamese PCM fixture first; do not substitute private media',
  );
const pcm = await readFile('output/research-assets/evaluation/0.f32');
if (pcm.length < 2 * 16000 * 4 || pcm.length > 60 * 16000 * 4 || pcm.length % 4)
  throw new Error('Invalid bounded mono 16 kHz float32 fixture');
for (let offset = 0; offset < pcm.length; offset += 4)
  if (!Number.isFinite(pcm.readFloatLE(offset))) throw new Error('Non-finite PCM');
await mkdir(destination, { recursive: true });
let image;
try {
  image = await readFile(`${destination}/astronaut.png`);
} catch {
  /* explicit download below */
}
if (!image || hash(image) !== expected) {
  const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error('Public-domain fixture download failed');
  image = Buffer.from(await response.arrayBuffer());
}
if (hash(image) !== expected) throw new Error('Image checksum mismatch');
await writeFile(`${destination}/astronaut.png`, image);
await writeFile(
  `${destination}/manifest.json`,
  JSON.stringify(
    {
      image: '/research/benchmark/astronaut.png',
      imageSha256: expected,
      imageSource: source,
      imageLicense:
        'Public domain; NASA Eileen Collins; https://scikit-image.org/docs/stable/api/skimage.data.html#skimage.data.astronaut',
      audio: sample.url,
      audioSha256: hash(pcm),
      audioSource: 'google/fleurs vi_vn validation sample 1594',
      audioLicense: 'CC-BY-4.0',
      scope: 'Synthetic unaligned load only. No expression ground truth.',
    },
    null,
    2,
  ) + '\n',
);
console.log('Licensed load fixtures verified. No accuracy claim.');
