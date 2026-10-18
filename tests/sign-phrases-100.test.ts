import { describe, expect, it } from 'vitest';
import {
  findPrototypeSignPhrase,
  normalizeSignPhrase,
  signPhrases100Catalogue,
} from '../src/domain/signPhrases';

describe('100 Sign Phrases Catalogue & Matcher', () => {
  it('contains exactly 100 common phrases', () => {
    expect(signPhrases100Catalogue).toHaveLength(100);
  });

  it('contains unique sentence texts', () => {
    const keys = signPhrases100Catalogue.map((p) => normalizeSignPhrase(p.text));
    const unique = new Set(keys);
    expect(unique.size).toBe(100);
  });

  it('matches common phrases case-insensitively with punctuation stripped', () => {
    const match1 = findPrototypeSignPhrase('XIN VIẾT RA GIẤY GIÚP TÔI!');
    expect(match1).toBeDefined();
    expect(match1?.id).toBe('SENT064');

    const match2 = findPrototypeSignPhrase('Tôi muốn đăng ký khám sức khỏe.');
    expect(match2).toBeDefined();
    expect(match2?.id).toBe('SENT001');

    const match3 = findPrototypeSignPhrase('  Bác sĩ tên là gì ạ?  ');
    expect(match3).toBeDefined();
    expect(match3?.id).toBe('SENT003');
  });

  it('does not match sentences with extra negative words or unrelated text', () => {
    expect(findPrototypeSignPhrase('Tôi không muốn đăng ký khám sức khỏe.')).toBeUndefined();
    expect(findPrototypeSignPhrase('Tôi muốn đăng ký khám sức khỏe vào ngày mai.')).toBeUndefined();
    expect(findPrototypeSignPhrase('Một câu ngẫu nhiên không có trong danh mục.')).toBeUndefined();
  });
});
