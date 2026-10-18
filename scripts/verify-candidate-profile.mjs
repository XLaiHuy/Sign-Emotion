import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const json = async (file) => JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
const face = await json('public/models/manifest.json');
const conversation = await json('public/models/conversation-manifest.json');
const budget = await json('scripts/product-budget.json');
const gip = await json('output/research-assets/gipformer/manifest.json');
const comparison = await json('output/research-assets/face-comparison-manifest.json');
if (
  gip.revision !== 'dd9227dcd8705c13f33bdbe59728d546ab94480f' ||
  gip.runtime.version !== '1.13.8' ||
  comparison.runtime.version !== '1.30.0'
)
  throw new Error('Unexpected candidate/runtime revision');
const baseline = new Map(
  [...face.assets, ...conversation.packs.flatMap((pack) => pack.assets)].map((asset) => [
    asset.url,
    asset,
  ]),
);
const selected = new Map(
  [
    ...face.assets.filter((asset) => asset.url !== '/models/enet_b2_8.onnx'),
    ...conversation.packs.flatMap((pack) =>
      pack.id === 'speech'
        ? pack.assets.filter((asset) => asset.url === '/models/local/silero_vad.onnx')
        : pack.assets,
    ),
  ].map((asset) => [asset.url, { ...asset, path: `public${asset.url}` }]),
);
for (const asset of gip.assets)
  selected.set(`/research/gipformer/${asset.file}`, {
    url: `/research/gipformer/${asset.file}`,
    bytes: asset.size,
    sha256: asset.sha256,
    path: `output/research-assets/gipformer/${asset.file}`,
  });
for (const asset of comparison.runtime.files)
  selected.set(`/research/runtime-ort-gpu/${asset.file}`, {
    url: `/research/runtime-ort-gpu/${asset.file}`,
    bytes: asset.bytes,
    sha256: asset.sha256,
    path: `output/research-assets/runtime-ort-gpu/${asset.file}`,
  });
selected.set('/research/emotieff-b0/enet_b0_8_best_afew.onnx', {
  url: '/research/emotieff-b0/enet_b0_8_best_afew.onnx',
  bytes: 16039595,
  sha256: '7aa2ea31c1311f4f8aa9d3fdb085d418dd4e7a48c4b9ed41df8c044f91d0213f',
  path: 'output/research-assets/emotieff-b0/enet_b0_8_best_afew.onnx',
});
for (const asset of selected.values()) {
  const bytes = await readFile(asset.path);
  if (
    bytes.length !== asset.bytes ||
    createHash('sha256').update(bytes).digest('hex') !== asset.sha256
  )
    throw new Error(`Candidate checksum mismatch: ${asset.url}`);
}
const total = [...selected.values()].reduce((sum, asset) => sum + asset.bytes, 0);
if (total > budget.baselineBytes + budget.maximumIncreaseBytes)
  throw new Error('Candidate exceeds asset budget');
const report = {
  profile: 'pc-candidate',
  researchOnly: true,
  validated: false,
  bytes: total,
  currentBaselineBytes: [...baseline.values()].reduce((sum, asset) => sum + asset.bytes, 0),
  budgetBaselineBytes: budget.baselineBytes,
  maximumIncreaseBytes: budget.maximumIncreaseBytes,
  includesDormantB2: false,
  optionalToneIncluded: false,
  scope:
    'Selected model/runtime asset URLs, not RAM or application bundle; B2 is excluded from candidate cache and generated runtime image.',
  assets: [...selected.values()].map(({ path, ...asset }) => asset),
};
await mkdir('output/research-evaluation', { recursive: true });
await writeFile(
  'output/research-evaluation/candidate-profile.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  `Candidate: ${(total / 1048576).toFixed(2)} MiB, ${selected.size} assets verified; research only.`,
);
