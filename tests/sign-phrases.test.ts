import { expect, it } from 'vitest';
import { approvedSignPhrases, findSignPhrase, type SignPhrase } from '../src/domain/signPhrases';
const fixture: SignPhrase = {
  id: 'test',
  text: 'Tôi có 2 cuốn sách.',
  region: 'TP.HCM',
  source: 'https://example.org/fixture',
  revision: 'fixture',
  license: 'test only',
  attribution: 'fixture, not distributed',
  motionUrl: '/fixture.glb',
  sha256: 'a'.repeat(64),
  regionVerified: true,
  meaningVerified: true,
  motionVerified: true,
};
it('matches only the whole approved sentence while preserving accents, negation, numbers and names', () => {
  expect(findSignPhrase(' TÔI  CÓ 2 cuốn sách! ', [fixture])).toBe(fixture);
  for (const text of [
    'Tôi không có 2 cuốn sách.',
    'Tôi có 3 cuốn sách.',
    'Tôi có 2 cuốn sách của An.',
    'Toi co 2 cuon sach',
  ])
    expect(findSignPhrase(text, [fixture])).toBeUndefined();
  expect(findSignPhrase('Bạn nói chậm nhé', [{ ...fixture, text: 'Bạn nói chậm nhé' }])?.id).toBe(
    'test',
  );
});
it('keeps unverified research samples out of production', () => {
  expect(approvedSignPhrases).toHaveLength(0);
  for (const flag of ['regionVerified', 'meaningVerified', 'motionVerified'] as const)
    expect(findSignPhrase(fixture.text, [{ ...fixture, [flag]: false }])).toBeUndefined();
});
