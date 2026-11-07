import type { Expression } from '../contracts';

/** Larger, quiet color fields; the dark semantic colors remain the readable accents. */
export const emotionSurfaces: Record<Expression, string> = {
  happy: '#FFF0B3',
  sad: '#DDEEFF',
  angry: '#FCE3DF',
  surprised: '#F8E0EF',
  fear: '#EEE2FC',
  disgust: '#E9F1D2',
  neutral: '#EDF1E9',
};

/** Deep luminous glass tints for High-Contrast Dark Mode stages so #f8fafc text stays crisp. */
export const emotionDarkSurfaces: Record<Expression, string> = {
  happy: 'rgba(146, 94, 12, 0.34)',
  sad: 'rgba(29, 78, 168, 0.36)',
  angry: 'rgba(153, 27, 27, 0.36)',
  surprised: 'rgba(134, 25, 143, 0.34)',
  fear: 'rgba(76, 29, 149, 0.36)',
  disgust: 'rgba(63, 98, 18, 0.34)',
  neutral: 'rgba(13, 62, 52, 0.42)',
};
