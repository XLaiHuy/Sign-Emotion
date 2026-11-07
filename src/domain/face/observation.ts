import type { InferenceResult } from '../../shared/contracts';

export function observationReason(result: InferenceResult): string {
  if (result.decisionReason === 'stale-result') return 'stale-result';
  if (result.status === 'no-face' || result.status === 'multiple-faces') return result.status;
  if (result.qualityReason) return result.qualityReason;
  if (result.label && result.status === 'valid') return 'observed';
  return result.decisionReason ?? 'invalid-input';
}

/** Fixed vocabulary, bounded counters; no per-frame history or persistent storage. */
export class ObservationCounts {
  total = 0;
  reasons: Record<string, number> = {};
  private timestamp: number | undefined;
  add(result: InferenceResult) {
    if (!result.imageDiagnostics || result.timestamp === this.timestamp) return;
    this.timestamp = result.timestamp;
    this.total++;
    const reason = observationReason(result);
    this.reasons[reason] = (this.reasons[reason] ?? 0) + 1;
  }
}
