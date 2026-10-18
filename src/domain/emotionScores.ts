import type { Expression } from '../shared/contracts';
import type { ModalityEvidence } from './conversation';

const mapping: Record<string, Expression> = {
  enjoyment: 'happy',
  happiness: 'happy',
  happy: 'happy',
  hap: 'happy',
  sadness: 'sad',
  sad: 'sad',
  anger: 'angry',
  angry: 'angry',
  ang: 'angry',
  surprise: 'surprised',
  surprised: 'surprised',
  sur: 'surprised',
  neutral: 'neutral',
  neu: 'neutral',
  fear: 'fear',
  fearful: 'fear',
  disgust: 'disgust',
  disgusted: 'disgust',
};
export function mapEmotionScores(logits: ArrayLike<number>, names: string[]) {
  const values = Array.from(logits);
  if (values.length !== names.length || values.some((v) => !Number.isFinite(v)))
    throw new Error('Invalid emotion output');
  const maximum = Math.max(...values);
  const exp = values.map((v) => Math.exp(v - maximum));
  const sum = exp.reduce((a, b) => a + b, 0);
  const scores: ModalityEvidence['scores'] = {};
  let unsupportedScore = 0;
  exp.forEach((value, i) => {
    const label = mapping[names[i].toLowerCase()];
    if (label) scores[label] = (scores[label] ?? 0) + value / sum;
    else unsupportedScore += value / sum;
  });
  return { scores, unsupportedScore };
}
