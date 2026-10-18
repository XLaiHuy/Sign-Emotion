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
