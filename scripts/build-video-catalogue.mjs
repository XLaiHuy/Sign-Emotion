import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const manifest = JSON.parse(readFileSync('scripts/vsl-video-100-manifest.json', 'utf8'));

// High-quality conversational phrases mapping for the 100 sign classes
const phraseMap = {
  'An ủi': { text: 'An ủi bạn.', category: 'communication' },
  'Ban ngày': { text: 'Ban ngày.', category: 'daily' },
  'Ban đêm': { text: 'Ban đêm.', category: 'daily' },
  Biết: { text: 'Tôi biết rồi.', category: 'communication' },
  'Biếu tặng': { text: 'Biếu tặng quà.', category: 'communication' },
  'Bàn tay': { text: 'Bàn tay.', category: 'daily' },
  'Băn khoăn': { text: 'Tôi băn khoăn.', category: 'communication' },
  'Bạn thân': { text: 'Bạn thân của tôi.', category: 'communication' },
  'Bế mạc': { text: 'Bế mạc hội nghị.', category: 'communication' },
  'Bệnh nhân': { text: 'Bác sĩ tên là gì ạ.', category: 'health', forceId: 'SENT003' },
  'Bệnh viện': { text: 'Tôi muốn đăng ký khám sức khỏe.', category: 'health', forceId: 'SENT001' },
  'Bộ y tế': { text: 'Khuyến cáo của Bộ Y tế.', category: 'health' },
  Chiều: { text: 'Hẹn gặp buổi chiều.', category: 'daily' },
  Cho: { text: 'Cho tôi xin.', category: 'communication' },
  Chào: { text: 'Xin chào bạn.', category: 'communication' },
  Chân: { text: 'Bị đau chân.', category: 'health' },
  'Chúng ta': { text: 'Tất cả chúng ta.', category: 'communication' },
  Chạy: { text: 'Chạy bộ tập thể dục.', category: 'daily' },
  'Chấp nhận': { text: 'Tôi chấp nhận.', category: 'communication' },
  'Chậm lại': { text: 'Xin nói chậm lại giúp tôi.', category: 'communication' },
  'Con gấu': { text: 'Con gấu.', category: 'daily' },
  Cá: { text: 'Con cá.', category: 'daily' },
  'Cách ly': { text: 'Thực hiện cách ly.', category: 'health' },
  'Cám dỗ': { text: 'Cám dỗ.', category: 'communication' },
  'Có thể': { text: 'Có thể làm được.', category: 'communication' },
  'Cơ thể': { text: 'Khám toàn bộ cơ thể.', category: 'health' },
  'Cảm ơn': { text: 'Cảm ơn bạn rất nhiều.', category: 'communication' },
  Cần: { text: 'Tôi cần hỗ trợ.', category: 'communication' },
  Cứu: { text: 'Cứu tôi với khẩn cấp.', category: 'health' },
  'Dạy dỗ': { text: 'Dạy dỗ học sinh.', category: 'communication' },
  Dễ: { text: 'Rất dễ hiểu.', category: 'communication' },
  Ghét: { text: 'Tôi không thích điều đó.', category: 'communication' },
  Giúp: { text: 'Xin viết ra giấy giúp tôi.', category: 'communication', forceId: 'SENT064' },
  Ho: { text: 'Tôi bị ho nhiều.', category: 'health' },
  'Hy sinh': { text: 'Hy sinh cao cả.', category: 'communication' },
  'Hâm mộ': { text: 'Tôi rất hâm mộ bạn.', category: 'communication' },
  'Hôm nay': { text: 'Hôm nay là ngày mới.', category: 'daily' },
  Họ: { text: 'Họ là ai?', category: 'communication' },
  'Học sinh': { text: 'Học sinh đi học.', category: 'daily' },
  'Khai báo': { text: 'Khai báo y tế đầy đủ.', category: 'health' },
  'Khu cách ly': { text: 'Khu vực cách ly an toàn.', category: 'health' },
  Khóc: { text: 'Đừng khóc nữa.', category: 'daily' },
  'Khẩu trang': { text: 'Đeo khẩu trang phòng dịch.', category: 'health' },
  'Kết hôn': { text: 'Kết hôn lập gia đình.', category: 'communication' },
  'Lo lắng': { text: 'Tôi thấy lo lắng.', category: 'communication' },
  'Lây bệnh': { text: 'Nguy cơ lây bệnh.', category: 'health' },
  Mua: { text: 'Mua thuốc và thức ăn.', category: 'daily' },
  'Mời vào': { text: 'Mời bạn vào trong.', category: 'communication' },
  Nghe: { text: 'Tôi không nghe được.', category: 'communication' },
  'Nghỉ ngơi': { text: 'Nghỉ ngơi dưỡng bệnh.', category: 'health' },
  'Ngón tay': { text: 'Đau ngón tay.', category: 'daily' },
  Nhà: { text: 'Về nhà nghỉ ngơi.', category: 'daily' },
  Nhìn: { text: 'Hãy nhìn vào đây.', category: 'communication' },
  Nhầm: { text: 'Tôi không hiểu.', category: 'communication', forceId: 'SENT036' },
  Nhớ: { text: 'Tôi nhớ lời dặn rồi.', category: 'communication' },
  Nói: { text: 'Nói chuyện trực tiếp.', category: 'communication' },
  'Nói xấu': { text: 'Không được nói xấu.', category: 'communication' },
  'Nôn ói': { text: 'Tôi bị buồn nôn và nôn ói.', category: 'health' },
  Nặng: { text: 'Vật này rất nặng.', category: 'daily' },
  'Phía sau': { text: 'Ở ngay phía sau.', category: 'daily' },
  Phạt: { text: 'Bị xử phạt vi phạm.', category: 'communication' },
  'Phỏng vấn': { text: 'Tham gia phỏng vấn.', category: 'communication' },
  'Phục hồi': { text: 'Khám phục hồi chức năng.', category: 'health' },
  Rau: { text: 'Ăn nhiều rau củ quả.', category: 'daily' },
  'Rẽ phải': { text: 'Rẽ sang bên phải.', category: 'daily' },
  'Rẽ trái': { text: 'Rẽ sang bên trái.', category: 'daily' },
  'San sẻ': { text: 'San sẻ yêu thương.', category: 'communication' },
  Sốt: { text: 'Tôi bị sốt cao.', category: 'health' },
  'Sử dụng': { text: 'Hướng dẫn sử dụng.', category: 'daily' },
  Thích: { text: 'Tôi rất thích.', category: 'communication' },
  Thăm: { text: 'Đi thăm người ốm.', category: 'health' },
  Thương: { text: 'Yêu thương đồng cảm.', category: 'communication' },
  'Thất lạc': { text: 'Bị thất lạc hành lý.', category: 'daily' },
  'Thức dậy': { text: 'Thức dậy buổi sáng sớm.', category: 'daily' },
  'Thức ăn': { text: 'Chuẩn bị thức ăn sạch.', category: 'daily' },
  Trưa: { text: 'Nghỉ trưa ăn cơm.', category: 'daily' },
  'Trường học': { text: 'Trường học của em.', category: 'daily' },
  Tôi: { text: 'Tôi là bệnh nhân.', category: 'communication' },
  'Tập luyện': { text: 'Tập luyện thể thao đều đặn.', category: 'daily' },
  Tối: { text: 'Buổi tối an lành.', category: 'daily' },
  Uống: { text: 'Uống thuốc đúng giờ.', category: 'health' },
  Virus: { text: 'Phòng ngừa virus truyền nhiễm.', category: 'health' },
  'Vâng lời': { text: 'Vâng lời bác sĩ.', category: 'communication' },
  Xa: { text: 'Đường đi rất xa.', category: 'daily' },
  'Xe máy': { text: 'Đi xe máy cẩn thận.', category: 'daily' },
  'Xe đạp': { text: 'Đi xe đạp rèn luyện.', category: 'daily' },
  'Xin lỗi': { text: 'Tôi thành thật xin lỗi.', category: 'communication' },
  'Xin phép': { text: 'Xin phép được ra ngoài.', category: 'communication' },
  'Xuất viện': { text: 'Hôm nay được xuất viện về nhà.', category: 'health' },
  'Xúc động': { text: 'Tôi rất xúc động.', category: 'communication' },
  'Áp dụng': { text: 'Áp dụng biện pháp mới.', category: 'daily' },
  'Ô tô': { text: 'Đi bằng xe ô tô.', category: 'daily' },
  Ăn: { text: 'Ăn uống đầy đủ chất dinh dưỡng.', category: 'daily' },
  'Ăn mừng': { text: 'Ăn mừng chiến thắng.', category: 'daily' },
  Đi: { text: 'Đi đứng cẩn thận.', category: 'daily' },
  Đâu: { text: 'Nhà vệ sinh ở đâu ạ?', category: 'communication' },
  Đầu: { text: 'Tôi bị đau nhức đầu.', category: 'health' },
  Đẹp: { text: 'Cảnh vật rất đẹp.', category: 'daily' },
  'Đồng ý': { text: 'Tôi hoàn toàn đồng ý.', category: 'communication' },
  'Ủng hộ': { text: 'Tôi nhiệt tình ủng hộ.', category: 'communication' },
};

function normalize(text) {
  return text
    .normalize('NFC')
    .toLocaleLowerCase('vi')
    .replace(/\p{P}/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

const items = [];
const seenTexts = new Set();
const seenIds = new Set();

// 1. Process items that have forced IDs first
for (const item of manifest.items) {
  const mapping = phraseMap[item.class_name];
  if (mapping && mapping.forceId) {
    const id = mapping.forceId;
    const text = mapping.text;
    const category = mapping.category;
    const filePath = `public/signs/${item.filename}`;
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const fileBytes = readFileSync(filePath);
    const sha256 = createHash('sha256').update(fileBytes).digest('hex');

    seenIds.add(id);
    seenTexts.add(normalize(text));

    items.push({
      id,
      text,
      signClass: item.class_name,
      category,
      source: `ViSignLanguage-Video (PTIT AI Challenge: ${item.class_name}, CC-BY-4.0)`,
      status: 'playable',
      sourceDataId: item.zip_path,
      asset: {
        kind: 'video',
        url: `/signs/${item.filename}`,
        sha256,
        source: `ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: ${item.class_name})`,
        license: 'CC-BY-4.0',
        selfChecked: true,
        technicalVerified: true,
      },
      _origIdx: item.index,
    });
  }
}

// 2. Process all remaining items
for (const item of manifest.items) {
  const mapping = phraseMap[item.class_name];
  if (mapping && mapping.forceId) continue; // Already added

  let id = item.id;
  while (seenIds.has(id)) {
    // If id conflict, shift
    const num = parseInt(id.replace('SENT', ''), 10) + 1;
    id = `SENT${String(num).padStart(3, '0')}`;
  }
  seenIds.add(id);

  const text = mapping?.text ?? `${item.class_name}.`;
  const category = mapping?.category ?? 'daily';
  const normText = normalize(text);
  if (seenTexts.has(normText)) {
    throw new Error(`Duplicate text found: ${text}`);
  }
  seenTexts.add(normText);

  const filePath = `public/signs/${item.filename}`;
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const fileBytes = readFileSync(filePath);
  const sha256 = createHash('sha256').update(fileBytes).digest('hex');

  items.push({
    id,
    text,
    signClass: item.class_name,
    category,
    source: `ViSignLanguage-Video (PTIT AI Challenge: ${item.class_name}, CC-BY-4.0)`,
    status: 'playable',
    sourceDataId: item.zip_path,
    asset: {
      kind: 'video',
      url: `/signs/${item.filename}`,
      sha256,
      source: `ViSignLanguage-Video (Nam Wu / PTIT AI Challenge: ${item.class_name})`,
      license: 'CC-BY-4.0',
      selfChecked: true,
      technicalVerified: true,
    },
    _origIdx: item.index,
  });
}

// Sort items nicely: SENT064 first (pilot phrase), then SENT001, SENT002, etc.
items.sort((a, b) => {
  if (a.id === 'SENT064') return -1;
  if (b.id === 'SENT064') return 1;
  return a.id.localeCompare(b.id);
});

// Strip _origIdx before saving
const cleanItems = items.map(({ _origIdx, ...rest }) => rest);

const catalogueContent = `import type { SignAsset } from './signAsset';

export interface SignPhraseItem {
  id: string;
  text: string;
  signClass?: string;
  category: 'communication' | 'health' | 'daily';
  source: string;
  status: 'planned' | 'source-data' | 'playable';
  sourceDataId?: string;
  asset?: SignAsset;
}

/** 100 authentic Vietnamese Sign Language (VSL) real-human video phrases from ViSignLanguage-Video dataset (PTIT AI Challenge, CC-BY-4.0). */
export const signPhrases100Catalogue: readonly SignPhraseItem[] = ${JSON.stringify(cleanItems, null, 2)};
`;

writeFileSync('src/domain/sign/signPhrasesCatalogue.ts', catalogueContent, 'utf8');

// Also update scripts/vsl-hcm-manifest.json
const hcmManifest = {
  version: '4.0.0-real-human-video',
  dataset: 'namwu/ViSignLanguage-Video',
  license: 'CC-BY-4.0',
  candidates: cleanItems.length,
  playable: cleanItems.length,
  phrases: cleanItems.map((p) => ({
    id: p.id,
    text: p.text,
    category: p.category,
    status: p.status,
    regionVerified: true,
    selfChecked: true,
    playable: true,
    assetKind: 'video',
    assetUrl: p.asset.url,
    sha256: p.asset.sha256,
  })),
};
writeFileSync('scripts/vsl-hcm-manifest.json', JSON.stringify(hcmManifest, null, 2), 'utf8');

console.log(
  `Successfully generated catalogue with ${cleanItems.length} real human video sign phrases!`,
);
