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

export function findPrototypeSignPhrase(
  text: string,
  catalogue: readonly SignPhraseItem[] = signPhrases100Catalogue,
): SignPhraseItem | undefined {
  const key = normalizeSignPhrase(text);
  if (!key) return undefined;
  // Preserve the whole utterance: a keyword inside a longer/negated sentence
  // must never select a video that changes its meaning.
  const exact = catalogue.find((item) => normalizeSignPhrase(item.text) === key);
  if (exact) return exact;

  // A standalone class name can still be looked up explicitly.
  const classMatch = catalogue.find(
    (item) => item.signClass && normalizeSignPhrase(item.signClass) === key,
  );
  return classMatch;
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
