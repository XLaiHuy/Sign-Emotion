import { expect, it } from 'vitest';
import { isSuspiciousRecognition, reviseCaption } from '../src/domain/captionRevision';

it('flags decoder repetition loops without rewriting recognized speech', () => {
  expect(isSuspiciousRecognition('Bây giờ, bây giờ, bây giờ, bây giờ, bây giờ, bây giờ.')).toBe(
    true,
  );
  expect(isSuspiciousRecognition('Tôi không đồng ý với đề xuất này.')).toBe(false);
  expect(reviseCaption('Tôi không đồng ý với đề xuất này.').text).toBe(
    'Tôi không đồng ý với đề xuất này.',
  );
});
