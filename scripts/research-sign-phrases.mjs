// Public-source inspection only. Never adds clips or unverified motion to production.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const repo = 'nguyentheanh822/Vietnamese-Sign-Language-Translation';
const revision = '6c351e63c0b2cf1b5e2e8056bb3bf2d6f31dc90a';
const base = `https://raw.githubusercontent.com/${repo}/${revision}/`;
const directory = 'output/research-assets/vsl-gh';
await mkdir(directory, { recursive: true });
async function read(path, limit = 8 * 1024 * 1024) {
  const response = await fetch(base + path);
  if (!response.ok) throw new Error(`Public source unavailable: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > limit) throw new Error('Research file exceeds bounded limit');
  return bytes;
}
const files = [];
async function save(path, name) {
  const bytes = await read(path);
  await writeFile(`${directory}/${name}`, bytes);
  files.push({
    source: base + path,
    file: name,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  return bytes;
}
await save('README.md', 'README.md');
await save('LICENSE', 'LICENSE');
const data = JSON.parse((await save('data/dataset.json', 'dataset.json')).toString('utf8'));
const candidates = [];
const seen = new Set();
for (const item of data) {
  if (
    item.view !== 'F' ||
    item.signer_id !== 'S01' ||
    item.repetition !== 'R01' ||
    seen.has(item.sentence_id)
  )
    continue;
  if (!/chào|cảm ơn|xin lỗi|nói lại|nói chậm|giúp|hướng dẫn/iu.test(item.translation)) continue;
  seen.add(item.sentence_id);
  const name = `${item.id}.npy`;
  const bytes = await save(`data/keypoints/${name}`, name);
  const headerLength = bytes[6] === 1 ? bytes.readUInt16LE(8) : bytes.readUInt32LE(8);
  const header = bytes
    .subarray(bytes[6] === 1 ? 10 : 12, (bytes[6] === 1 ? 10 : 12) + headerLength)
    .toString('latin1');
  candidates.push({
    id: item.id,
    text: item.translation,
    numpyHeader: header.trim(),
    regionVerified: false,
    meaningVerified: false,
    motionVerified: false,
  });
  if (candidates.length === 10) break;
}
const report = {
  repo,
  revision,
  retrievedAt: new Date().toISOString(),
  sourceLicence: 'MIT as provided by upstream',
  regionVerified: false,
  approvedProductionPhrases: 0,
  candidates,
  files,
  limitations: [
    'No TP.HCM regional declaration verified',
    'Keypoints are not an approved rig animation',
    'No native-language or finger-motion verification',
    'No recognition checkpoint is treated as text-to-motion',
  ],
};
await writeFile(`${directory}/inspection.json`, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    candidates: candidates.length,
    productionApproved: 0,
    downloadedBytes: files.reduce((sum, item) => sum + item.bytes, 0),
    report: `${directory}/inspection.json`,
  }),
);
