import { readFileSync, writeFileSync } from 'node:fs';

const revision = '6c351e63c0b2cf1b5e2e8056bb3bf2d6f31dc90a';
const data = JSON.parse(readFileSync('output/research-assets/vsl-gh/dataset.json', 'utf8'));
const normalize = (text) =>
  text
    .normalize('NFC')
    .toLocaleLowerCase('vi')
    .replace(/\p{P}/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
const source = `https://github.com/nguyentheanh822/Vietnamese-Sign-Language-Translation/tree/${revision}`;
const originals = new Map(data.map((item) => [normalize(item.translation), item]));
const priority = [
  ['SENT064', 'Xin viết ra giấy giúp tôi.', 'communication'],
  ['GREET001', 'Xin chào, rất vui được gặp bạn.', 'communication'],
  ['GREET002', 'Cảm ơn bạn rất nhiều.', 'communication'],
  ['GREET003', 'Xin lỗi, bạn có thể nói chậm lại không?', 'communication'],
  ['GREET004', 'Tạm biệt, hẹn gặp lại.', 'communication'],
  ['EMO001', 'Hôm nay tôi rất vui.', 'daily'],
  ['EMO002', 'Tôi cảm thấy hơi buồn.', 'daily'],
  ['EMO003', 'Tôi đang lo lắng.', 'daily'],
];
const list = new Map();
function add(id, text, category) {
  const key = normalize(text);
  if (!key || list.has(key)) return;
  const sample = originals.get(key);
  list.set(key, {
    id,
    text,
    category,
    source: sample ? source : 'Câu do dự án đề xuất; chưa có tư liệu ký hiệu.',
    status: sample ? 'source-data' : 'planned',
    ...(sample ? { sourceDataId: sample.id } : {}),
  });
}
priority.forEach((item) => add(...item));
for (const item of data) {
  if (list.size >= 100) break;
  add(
    item.sentence_id,
    item.translation,
    /khám|bác sĩ|sức khỏe|bệnh|thuốc|đau|máu|nhiệt độ|huyết áp/iu.test(item.translation)
      ? 'health'
      : 'daily',
  );
}
const items = [...list.values()];
const output = `import type { SignAsset } from './signAsset';

export interface SignPhraseItem {
  id: string;
  text: string;
  category: 'communication' | 'health' | 'daily';
  source: string;
  status: 'planned' | 'source-data' | 'playable';
  sourceDataId?: string;
  asset?: SignAsset;
}

/** Text candidates, NOT a claim that 100 signing animations exist. */
export const signPhrases100Catalogue: readonly SignPhraseItem[] = ${JSON.stringify(items, null, 2)};
`;
writeFileSync('src/domain/sign/signPhrasesCatalogue.ts', output, 'utf8');
console.log(
  JSON.stringify({
    candidates: items.length,
    sourceData: items.filter((p) => p.sourceDataId).length,
    playable: 0,
  }),
);
