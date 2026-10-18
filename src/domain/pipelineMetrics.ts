export const PIPELINE_STAGES = [
  'capture',
  'detection',
  'crop',
  'classifier',
  'face-delivery',
  'asr-partial',
  'asr-final',
  'partial-delivery',
  'final-delivery',
  'text',
  'fusion',
  'audio-gap',
  'final-queue-wait',
  'face-render',
  'face-label-render',
  'face-schedule-wait',
  'workload',
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];
export interface PipelineMetric {
  stage: PipelineStage;
  durationMs: number;
  queue?: number;
  rtf?: number;
  usable?: boolean;
  missedDeadlines?: number;
}

/** Explicit projection: arbitrary model output and exception text never leave this boundary. */
export function numericPipelineMetric(input: unknown): PipelineMetric | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (
    !PIPELINE_STAGES.includes(value.stage as PipelineStage) ||
    typeof value.durationMs !== 'number' ||
    !Number.isFinite(value.durationMs) ||
    value.durationMs < 0
  )
    return null;
  const result: PipelineMetric = {
    stage: value.stage as PipelineStage,
    durationMs: value.durationMs,
  };
  for (const key of ['queue', 'rtf', 'missedDeadlines'] as const) {
    const number = value[key];
    if (typeof number === 'number' && Number.isFinite(number) && number >= 0) result[key] = number;
  }
  if (typeof value.usable === 'boolean') result.usable = value.usable;
  return result;
}
