import { z } from 'zod';
import { expressions, type Expression, type InferenceResult } from '../shared/contracts';
export const referenceLabels = [...expressions, 'contempt', 'ignore'] as const;
export const segmentSchema = z
  .object({
    startMs: z.number().finite().min(0),
    endMs: z.number().finite().positive(),
    label: z.enum(referenceLabels),
  })
  .strict()
  .refine((s) => s.endMs > s.startMs, 'Thời gian kết thúc phải lớn hơn bắt đầu');
export type Segment = z.infer<typeof segmentSchema>;
export const segmentsSchema = z
  .array(segmentSchema)
  .max(5000)
  .superRefine((segments, ctx) => {
    const sorted = [...segments].sort((a, b) => a.startMs - b.startMs);
    for (let i = 1; i < sorted.length; i++)
      if (sorted[i].startMs < sorted[i - 1].endMs)
        ctx.addIssue({ code: 'custom', message: 'Các đoạn nhãn không được chồng lấn' });
  });
export interface EvaluationRow {
  timeMs: number;
  rawScores: number[];
  smoothedScores: number[];
  predicted: Expression | 'uncertain';
  status: InferenceResult['status'];
  reason: string;
  processingMs: number;
  trigger: Expression | null;
  auxiliaryScores?: number[];
}
export function referenceAt(timeMs: number, segments: Segment[]) {
  return segments.find((s) => s.startMs <= timeMs && timeMs < s.endMs)?.label ?? 'ignore';
}
export function evaluateRows(rows: EvaluationRow[], segments: Segment[]) {
  const labeled = rows
    .map((r) => ({ ...r, trueLabel: referenceAt(r.timeMs, segments) }))
    .filter((r) => r.trueLabel !== 'ignore');
  const perClass = Object.fromEntries(
    expressions.map((label) => {
      const tp = labeled.filter((r) => r.trueLabel === label && r.predicted === label).length;
      const support = labeled.filter((r) => r.trueLabel === label).length,
        predicted = labeled.filter((r) => r.predicted === label).length;
      const precision = predicted ? tp / predicted : 0,
        recall = support ? tp / support : 0;
      return [
        label,
        {
          support,
          precision,
          recall,
          f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
        },
      ];
    }),
  );
  const confusion: Record<string, Record<string, number>> = {};
  for (const row of labeled) {
    confusion[row.trueLabel] ??= {};
    confusion[row.trueLabel][row.predicted] = (confusion[row.trueLabel][row.predicted] ?? 0) + 1;
  }
  const falseTriggers = labeled.filter((r) => r.trigger && r.trigger !== r.trueLabel).length;
  // This rate is defined for deterministic 5 Hz evaluation, never wall-clock inference speed.
  return {
    labeledSamples: labeled.length,
    coverage: labeled.length
      ? labeled.filter((r) => r.predicted !== 'uncertain').length / labeled.length
      : 0,
    uncertainRate: labeled.length
      ? labeled.filter((r) => r.predicted === 'uncertain').length / labeled.length
      : 0,
    macroF1: expressions.reduce((s, l) => s + perClass[l].f1, 0) / expressions.length,
    perClass,
    confusion,
    falseTriggers,
    falseTriggersPerMinute: labeled.length ? falseTriggers / ((labeled.length * 0.2) / 60) : 0,
  };
}
export function evaluationCsv(rows: EvaluationRow[], segments: Segment[]) {
  const fields = [
    'time_ms',
    'true_label',
    'predicted_label',
    'status',
    'reason',
    'trigger',
    'processing_ms',
    ...Array.from({ length: 8 }, (_, i) => `raw_${i}`),
    ...Array.from({ length: 8 }, (_, i) => `ema_${i}`),
  ];
  return [
    fields,
    ...rows.map((r) => [
      r.timeMs,
      referenceAt(r.timeMs, segments),
      r.predicted,
      r.status,
      r.reason,
      r.trigger ?? '',
      r.processingMs,
      ...Array.from({ length: 8 }, (_, i) => r.rawScores[i] ?? ''),
      ...Array.from({ length: 8 }, (_, i) => r.smoothedScores[i] ?? ''),
    ]),
  ]
    .map((row) => row.map((v) => JSON.stringify(v)).join(','))
    .join('\r\n');
}
export function youtubeId(input: string) {
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:') return null;
    let id: string | null = null;
    if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
    if (['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(url.hostname))
      id =
        url.searchParams.get('v') ??
        url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)$/)?.[1] ??
        null;
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
