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

  it('matches natural conversational variations by keyword and sentence structure', () => {
    expect(findPrototypeSignPhrase('Tôi muốn đăng ký khám sức khỏe vào ngày mai.')?.id).toBe(
      'SENT001',
    );
    expect(findPrototypeSignPhrase('Dạ bác sĩ tên gì vậy ạ?')?.id).toBe('SENT003');
    expect(findPrototypeSignPhrase('Làm ơn nói chậm lại giúp em với nhé')?.id).toBe('SENT020');
    expect(findPrototypeSignPhrase('Mình bị đau đầu quá bác sĩ ơi')?.id).toBe('SENT098');
    expect(findPrototypeSignPhrase('Em không hiểu bác sĩ nói gì ạ')?.id).toBe('SENT036');
    expect(findPrototypeSignPhrase('Xin chào bác sĩ, tôi bị đau đầu')?.id).toBe('SENT098');
  });

  it('does not match sentences with blocking negation or unrelated text', () => {
    expect(findPrototypeSignPhrase('Tôi không muốn đăng ký khám sức khỏe.')).toBeUndefined();
    expect(findPrototypeSignPhrase('Không cảm ơn bạn.')).toBeUndefined();
    expect(findPrototypeSignPhrase('Tôi không bị đau đầu.')).toBeUndefined();
    expect(findPrototypeSignPhrase('Một câu ngẫu nhiên không có trong danh mục.')).toBeUndefined();
  });

  it('matches regional dialect phrase aliases (Central & Southern) without modifying catalogue', () => {
    // Southern "bữa nay" -> "hôm nay", Central "bựa ni" / "hôm ni" -> "hôm nay"
    expect(findPrototypeSignPhrase('Bữa nay là ngày mới.')?.id).toBe('SENT038');
    expect(findPrototypeSignPhrase('Bựa ni là ngày mới.')?.id).toBe('SENT038');
    expect(findPrototypeSignPhrase('Hôm ni là ngày mới.')?.id).toBe('SENT038');

    // Southern "nhức đầu" -> "đau đầu"
    expect(findPrototypeSignPhrase('Tôi bị nhức đầu quá bác sĩ ơi.')?.id).toBe('SENT098');
  });

  it('preserves single words unaliased and avoids false positive mappings', () => {
    // Single words ("răng", "chi", "ốm", "bận", "mốt") must NOT be converted
    // "đau răng" must not become "đau sao" or match headache
    expect(findPrototypeSignPhrase('Tôi bị đau răng')?.id).not.toBe('SENT098');
    // "chi tiền" must not become "gì tiền" or match doctor name query
    expect(findPrototypeSignPhrase('Anh chi tiền giúp em')?.id).not.toBe('SENT003');
  });

  it('blocks regional negative sentences with nỏ, hông, and hổng', () => {
    expect(findPrototypeSignPhrase('tui hổng khỏe')).toBeUndefined();
    expect(findPrototypeSignPhrase('tui nỏ bị đau đầu')).toBeUndefined();
    expect(findPrototypeSignPhrase('em hông bị đau đầu đâu ạ')).toBeUndefined();
    expect(findPrototypeSignPhrase('tôi nỏ muốn đăng ký khám sức khỏe')).toBeUndefined();
  });
});

