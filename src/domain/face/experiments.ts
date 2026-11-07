import type { FaceExperiment } from '../../shared/contracts';

export const faceExperiments: readonly FaceExperiment[] = [
  'baseline',
  'eye-crop',
  'low-light',
  'detector-050',
  'expression-050',
];
export function localFaceLab(hostname: string) {
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
}
export function faceExperimentConfig(value: unknown, research: boolean, hostname: string) {
  const experiment = value === undefined ? 'baseline' : value;
  if (!faceExperiments.includes(experiment as FaceExperiment))
    throw new Error('Cấu hình thử khuôn mặt không hợp lệ');
  if (experiment !== 'baseline' && (!research || !localFaceLab(hostname)))
    throw new Error('Cấu hình thử khuôn mặt chỉ dùng trong Lab trên localhost');
  return {
    id: experiment as FaceExperiment,
    detectionConfidence: experiment === 'detector-050' ? 0.5 : 0.6,
    expressionThreshold: experiment === 'expression-050' ? 0.5 : 0.55,
    preprocessingVersion:
      experiment === 'eye-crop'
        ? 'eye-crop-v2'
        : experiment === 'low-light'
          ? 'rgb-gamma-085-v1'
          : 'roll-crop-v1',
  };
}
