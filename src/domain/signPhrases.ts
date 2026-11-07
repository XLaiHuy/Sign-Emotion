/** Only whole, independently verified TP.HCM phrases may enter the product catalogue. */
export interface SignPhrase {
  id: string;
  text: string;
  region: 'TP.HCM';
  source: string;
  revision: string;
  license: string;
  attribution: string;
  motionUrl: string;
  sha256: string;
  regionVerified: boolean;
  meaningVerified: boolean;
  motionVerified: boolean;
}
export const approvedSignPhrases: readonly SignPhrase[] = [];

export function normalizeSignPhrase(text: string) {
  return text
    .normalize('NFC')
    .toLocaleLowerCase('vi')
    .replace(/\p{P}/gu, (mark, index, source: string) => {
      // Sentence punctuation is ignorable; signs and separators inside numbers are not.
      if (
        /[.,:/-]/.test(mark) &&
        /\d/.test(source[index + 1] ?? '') &&
        (/\d/.test(source[index - 1] ?? '') || mark === '-')
      )
        return mark;
      return ' ';
    })
    .replace(/\s+/gu, ' ')
    .trim();
}
export function findSignPhrase(text: string, catalogue = approvedSignPhrases) {
  const key = normalizeSignPhrase(text);
  if (!key) return undefined;
  return catalogue
    .slice(0, 10)
    .find(
      (item) =>
        item.region === 'TP.HCM' &&
        item.regionVerified &&
        item.meaningVerified &&
        item.motionVerified &&
        item.source &&
        item.license &&
        item.revision &&
        item.motionUrl &&
        /^[a-f0-9]{64}$/.test(item.sha256) &&
        normalizeSignPhrase(item.text) === key,
    );
}

import { signPhrases100Catalogue, type SignPhraseItem } from './sign/signPhrasesCatalogue';
import { eligibleSignAsset } from './sign/signAsset';
import type { TranscriptSegment } from './conversation';

export { signPhrases100Catalogue, type SignPhraseItem };

export const DIALECT_PHRASE_ALIASES: Readonly<Record<string, string>> = {
  // Central dialect phrases
  'đi mô': 'đi đâu',
  'ở mô': 'ở đâu',
  'làm chi': 'làm gì',
  'cái chi': 'cái gì',
  'răng rứa': 'sao vậy',
  'bựa ni': 'hôm nay',
  'hôm ni': 'hôm nay',
  'cái ni': 'cái này',
  // Southern dialect phrases
  'bữa nay': 'hôm nay',
  'nhức đầu': 'đau đầu',
  'bịnh': 'bệnh',
  'cái muỗng': 'cái thìa',
  'ly nước': 'cốc nước',
};

const DIALECT_ALIAS_PATTERNS: Array<{ readonly pattern: RegExp; readonly canonical: string }> =
  Object.entries(DIALECT_PHRASE_ALIASES).map(([alias, canonical]) => ({
    pattern: new RegExp(
      `(?<=^|[\\s\\p{P}])${alias.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}(?=[\\s\\p{P}]|$)`,
      'gui',
    ),
    canonical,
  }));

export function applyDialectAliases(text: string): string {
  let result = text;
  for (const { pattern, canonical } of DIALECT_ALIAS_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, canonical);
  }
  return result;
}

const NEGATION_TOKENS = new Set([
  'không',
  'chẳng',
  'chưa',
  'đừng',
  'chả',
  'khỏi',
  'cấm',
  'ngừng',
  'nỏ',
  'hông',
  'hổng',
]);

const CONVERSATIONAL_FILLERS = new Set([
  'ạ',
  'nhé',
  'nha',
  'nhỉ',
  'nghe',
  'nghen',
  'vậy',
  'thế',
  'với',
  'giùm',
  'hộ',
  'quá',
  'lắm',
  'nữa',
  'nào',
  'chút',
  'tí',
  'xíu',
  'dạ',
  'vâng',
  'thưa',
  'ơi',
  'à',
  'ừ',
  'ờ',
  'cơ',
  'mà',
]);

const PRONOUN_TOKENS = new Set([
  'tôi',
  'mình',
  'em',
  'anh',
  'chị',
  'cô',
  'chú',
  'bác',
  'con',
  'cháu',
  'bạn',
]);

/** Curated keyword-structure anchors for the 100 VSL classes (matched on word boundaries). */
const STRUCTURAL_SIGN_PATTERNS: Readonly<Record<string, readonly string[]>> = {
  giúp: ['viết ra giấy', 'ghi ra giấy', 'viết giấy giúp', 'xin viết ra giấy'],
  'bệnh viện': ['đăng ký khám', 'khám sức khỏe', 'đi khám bệnh', 'đến bệnh viện'],
  'an ủi': ['an ủi'],
  'bệnh nhân': ['bác sĩ tên là gì', 'bác sĩ tên gì', 'tên bác sĩ là gì'],
  'ban ngày': ['ban ngày'],
  'ban đêm': ['ban đêm', 'buổi đêm'],
  biết: ['tôi biết rồi', 'mình biết rồi', 'em biết rồi', 'đã biết rồi'],
  'biếu tặng': ['biếu tặng', 'tặng quà', 'biếu quà'],
  'bàn tay': ['bàn tay'],
  'băn khoăn': ['băn khoăn'],
  'bạn thân': ['bạn thân'],
  'bế mạc': ['bế mạc'],
  'bộ y tế': ['bộ y tế'],
  chiều: ['hẹn gặp buổi chiều', 'gặp buổi chiều', 'buổi chiều'],
  cho: ['cho tôi xin', 'cho mình xin', 'cho em xin'],
  chào: [
    'xin chào',
    'chào bạn',
    'chào bác sĩ',
    'chào anh',
    'chào chị',
    'chào cô',
    'chào chú',
    'chào em',
    'kính chào',
  ],
  chân: ['đau chân', 'bị đau chân', 'nhức chân', 'mỏi chân'],
  'chúng ta': ['tất cả chúng ta', 'chúng ta'],
  chạy: ['chạy bộ', 'tập thể dục'],
  'chấp nhận': ['chấp nhận'],
  'chậm lại': ['nói chậm lại', 'chậm lại giúp', 'xin nói chậm', 'nói từ từ'],
  'con gấu': ['con gấu'],
  cá: ['con cá'],
  'cách ly': ['thực hiện cách ly', 'phải cách ly', 'đi cách ly'],
  'cám dỗ': ['cám dỗ'],
  'có thể': ['có thể làm được'],
  'cơ thể': ['khám toàn bộ cơ thể', 'toàn bộ cơ thể', 'khám cơ thể'],
  'cảm ơn': ['cảm ơn', 'cám ơn'],
  cần: ['cần hỗ trợ', 'cần giúp đỡ'],
  cứu: ['cứu tôi', 'cứu với', 'cấp cứu', 'khẩn cấp'],
  'dạy dỗ': ['dạy dỗ'],
  dễ: ['dễ hiểu', 'rất dễ hiểu'],
  ghét: ['không thích điều đó', 'tôi không thích', 'mình không thích', 'em không thích'],
  ho: ['bị ho', 'ho nhiều'],
  'hy sinh': ['hy sinh'],
  'hâm mộ': ['hâm mộ'],
  'hôm nay': ['hôm nay là ngày mới'],
  họ: ['họ là ai'],
  'học sinh': ['học sinh đi học', 'học sinh'],
  'khai báo': ['khai báo y tế', 'khai báo đầy đủ'],
  'khu cách ly': ['khu cách ly', 'khu vực cách ly'],
  khóc: ['đừng khóc', 'nín khóc'],
  'khẩu trang': ['đeo khẩu trang', 'mang khẩu trang', 'khẩu trang'],
  'kết hôn': ['kết hôn', 'lập gia đình'],
  'lo lắng': ['lo lắng'],
  'lây bệnh': ['lây bệnh', 'nguy cơ lây', 'lây nhiễm'],
  mua: ['mua thuốc', 'mua thức ăn'],
  'mời vào': ['mời bạn vào', 'mời vào trong', 'mời anh vào', 'mời chị vào'],
  nghe: ['không nghe được', 'không nghe thấy', 'không nghe rõ'],
  'nghỉ ngơi': ['nghỉ ngơi dưỡng bệnh', 'nghỉ ngơi'],
  'ngón tay': ['đau ngón tay', 'ngón tay'],
  nhà: ['về nhà nghỉ ngơi', 'về nhà nghỉ'],
  nhìn: ['nhìn vào đây', 'hãy nhìn vào đây'],
  nhầm: ['tôi không hiểu', 'mình không hiểu', 'em không hiểu', 'không hiểu', 'chưa hiểu'],
  nhớ: ['nhớ lời dặn', 'nhớ rồi'],
  nói: ['nói chuyện trực tiếp', 'trò chuyện trực tiếp'],
  'nói xấu': ['không được nói xấu', 'đừng nói xấu'],
  'nôn ói': ['buồn nôn', 'nôn ói', 'bị nôn', 'bị ói'],
  nặng: ['vật này rất nặng', 'rất nặng'],
  'phía sau': ['ngay phía sau', 'ở phía sau'],
  phạt: ['xử phạt', 'bị phạt'],
  'phỏng vấn': ['phỏng vấn'],
  'phục hồi': ['phục hồi chức năng', 'khám phục hồi'],
  rau: ['ăn nhiều rau', 'rau củ quả'],
  'rẽ phải': ['rẽ sang bên phải', 'rẽ bên phải', 'rẽ phải', 'quẹo phải'],
  'rẽ trái': ['rẽ sang bên trái', 'rẽ bên trái', 'rẽ trái', 'quẹo trái'],
  'san sẻ': ['san sẻ'],
  sốt: ['bị sốt', 'sốt cao', 'đang sốt'],
  'sử dụng': ['hướng dẫn sử dụng', 'cách sử dụng'],
  thích: ['tôi rất thích', 'mình rất thích', 'em rất thích'],
  thăm: ['thăm người ốm', 'đi thăm bệnh', 'thăm bệnh nhân'],
  thương: ['yêu thương đồng cảm', 'yêu thương'],
  'thất lạc': ['thất lạc hành lý', 'thất lạc'],
  'thức dậy': ['thức dậy'],
  'thức ăn': ['thức ăn sạch', 'chuẩn bị thức ăn'],
  trưa: ['nghỉ trưa', 'ăn cơm trưa'],
  'trường học': ['trường học'],
  tôi: ['tôi là bệnh nhân', 'mình là bệnh nhân', 'em là bệnh nhân'],
  'tập luyện': ['tập luyện thể thao', 'tập thể thao'],
  tối: ['buổi tối an lành', 'chúc buổi tối'],
  uống: ['uống thuốc đúng giờ', 'uống thuốc'],
  virus: ['phòng ngừa virus', 'virus truyền nhiễm'],
  'vâng lời': ['vâng lời bác sĩ', 'nghe lời bác sĩ'],
  xa: ['đường đi rất xa', 'đường rất xa'],
  'xe máy': ['đi xe máy', 'xe máy'],
  'xe đạp': ['đi xe đạp', 'xe đạp'],
  'xin lỗi': ['xin lỗi', 'thành thật xin lỗi'],
  'xin phép': ['xin phép ra ngoài', 'xin phép được ra ngoài', 'xin phép'],
  'xuất viện': ['xuất viện'],
  'xúc động': ['xúc động'],
  'áp dụng': ['áp dụng biện pháp'],
  'ô tô': ['xe ô tô', 'đi ô tô'],
  ăn: ['ăn uống đầy đủ', 'đầy đủ chất dinh dưỡng'],
  'ăn mừng': ['ăn mừng'],
  đi: ['đi đứng cẩn thận', 'đi lại cẩn thận'],
  đâu: ['nhà vệ sinh ở đâu', 'nhà vệ sinh chỗ nào'],
  đầu: ['đau nhức đầu', 'đau đầu', 'nhức đầu'],
  đẹp: ['cảnh vật rất đẹp'],
  'đồng ý': ['hoàn toàn đồng ý', 'tôi đồng ý', 'mình đồng ý', 'em đồng ý', 'đồng ý'],
  'ủng hộ': ['nhiệt tình ủng hộ', 'ủng hộ'],
};

function extractNumbers(normalized: string): string[] {
  return normalized.match(/-?\d+(?:[.,:/-]\d+)*/g) ?? [];
}

function numbersCompatible(inputNorm: string, itemNorm: string): boolean {
  const itemNums = extractNumbers(itemNorm);
  const inputNums = extractNumbers(inputNorm);
  if (itemNums.length === 0 && inputNums.length === 0) return true;
  if (itemNums.length !== inputNums.length) return false;
  return itemNums.every((n, idx) => n === inputNums[idx]);
}

function findTokenSequence(haystack: readonly string[], needle: readonly string[]): number {
  if (!needle.length || needle.length > haystack.length) return -1;
  for (let i = haystack.length - needle.length; i >= 0; i--) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

function hasBlockingNegation(
  inputTokens: readonly string[],
  matchStartIndex: number,
  itemTokens: readonly string[],
): boolean {
  const itemHasNegation = itemTokens.some((t) => NEGATION_TOKENS.has(t));
  if (itemHasNegation) {
    return !inputTokens.some((t) => NEGATION_TOKENS.has(t));
  }
  const windowStart = Math.max(0, matchStartIndex - 4);
  for (let i = windowStart; i < matchStartIndex; i++) {
    if (NEGATION_TOKENS.has(inputTokens[i])) return true;
  }
  return false;
}

function stripStructuralCore(tokens: readonly string[]): string[] {
  return tokens.filter((t) => !CONVERSATIONAL_FILLERS.has(t) && !PRONOUN_TOKENS.has(t));
}

export function findPrototypeSignPhrase(
  text: string,
  catalogue: readonly SignPhraseItem[] = signPhrases100Catalogue,
): SignPhraseItem | undefined {
  const aliased = applyDialectAliases(text);
  const key = normalizeSignPhrase(aliased);
  if (!key) return undefined;

  // Tier 1: Exact normalized sentence or standalone signClass match
  const exact = catalogue.find((item) => normalizeSignPhrase(item.text) === key);
  if (exact) return exact;

  const classMatch = catalogue.find(
    (item) => item.signClass && normalizeSignPhrase(item.signClass) === key,
  );
  if (classMatch) return classMatch;

  const inputTokens = key.split(' ').filter(Boolean);
  if (inputTokens.length === 0) return undefined;
  const inputCore = stripStructuralCore(inputTokens);

  let bestItem: SignPhraseItem | undefined;
  let bestScore = -1;

  for (const item of catalogue) {
    const itemNorm = normalizeSignPhrase(item.text);
    if (!itemNorm || !numbersCompatible(key, itemNorm)) continue;
    const itemTokens = itemNorm.split(' ').filter(Boolean);
    const classNorm = item.signClass ? normalizeSignPhrase(item.signClass) : '';

    // Tier 2: Structural Core Match (after stripping conversational particles & pronouns)
    const itemCore = stripStructuralCore(itemTokens);
    if (
      itemCore.length >= 1 &&
      inputCore.length >= 1 &&
      itemCore.join(' ') === inputCore.join(' ') &&
      !hasBlockingNegation(inputTokens, 0, itemTokens)
    ) {
      const score = 1000 + itemCore.length * 25;
      if (score > bestScore) {
        bestScore = score;
        bestItem = item;
      }
      continue;
    }

    // Tier 3: Safe Keyword-Structure Anchor Match with Negation Guard
    const candidatePatterns: string[] = [itemNorm];
    if (itemCore.length >= 2) candidatePatterns.push(itemCore.join(' '));
    if (classNorm) {
      const curated = STRUCTURAL_SIGN_PATTERNS[classNorm];
      if (curated) candidatePatterns.push(...curated);
      if (classNorm.split(' ').length >= 2) candidatePatterns.push(classNorm);
    }

    let itemBestPatternScore = -1;
    for (const rawPattern of candidatePatterns) {
      const patternNorm = normalizeSignPhrase(rawPattern);
      if (!patternNorm) continue;
      const patternTokens = patternNorm.split(' ').filter(Boolean);
      const matchIdx = findTokenSequence(inputTokens, patternTokens);
      if (matchIdx === -1) continue;
      if (hasBlockingNegation(inputTokens, matchIdx, itemTokens)) continue;

      const itemTokenSet = new Set(itemTokens);
      const overlapCount = inputTokens.filter((t) => itemTokenSet.has(t)).length;
      const isGreeting = classNorm === 'chào';
      const categoryBonus = item.category === 'health' ? 18 : !isGreeting ? 10 : 0;
      const patternScore =
        patternTokens.length * 22 +
        overlapCount * 8 +
        categoryBonus +
        (matchIdx + patternTokens.length);
      if (patternScore > itemBestPatternScore) {
        itemBestPatternScore = patternScore;
      }
    }

    if (itemBestPatternScore > bestScore) {
      bestScore = itemBestPatternScore;
      bestItem = item;
    }
  }

  return bestItem;
}

export function findPlayableSignPhrase(text: string, catalogue = signPhrases100Catalogue) {
  const phrase = findPrototypeSignPhrase(text, catalogue);
  return phrase && eligibleSignAsset(phrase.asset) ? phrase : undefined;
}

/** Complete utterances only; a VAD hard cut is never a whole sentence. */
export function signUtterances(segments: readonly TranscriptSegment[]) {
  const result: { id: string; text: string; segmentId: string }[] = [];
  let group: TranscriptSegment[] = [];
  for (const segment of segments) {
    if (group.length && (!segment.utteranceId || group[0].utteranceId !== segment.utteranceId))
      group = [];
    group.push(segment);
    if (segment.boundary === 'limit') continue;
    result.push({
      id: segment.utteranceId ?? segment.id,
      text: group.map((s) => s.text).join(' '),
      segmentId: segment.id,
    });
    group = [];
  }
  return result;
}
