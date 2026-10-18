import type { TranscriptSegment } from './conversation';
export type AsrProfileId =
  | 'product'
  | 'phowhisper'
  | 'whisper-baseline'
  | 'gipformer-research'
  | 'moonshine-streaming-vi-research';
export interface AsrRequest {
  id: string;
  samples: Float32Array;
  startMs: number;
  endMs: number;
  revision?: number;
  boundary?: TranscriptSegment['boundary'];
  utteranceId?: string;
}
/** Window decoders share a lifecycle, without claiming stateful streaming. */
export interface AsrAdapter {
  prepare(): Promise<{
    modelVersion: string;
    fallback: boolean;
    executionProfile?: {
      runtime: 'official' | 'single' | 'two';
      backend: 'wasm';
      intraOpThreads: number | null;
      interOpThreads: number | null;
    };
  }>;
  acceptPcm(request: AsrRequest, final: boolean): Promise<TranscriptSegment>;
  reset(): void;
  dispose(): Promise<void>;
}
/** Includes every partial decode in effective RTF. */
export class AsrWorkload {
  private processingMs = 0;
  private completedAudioMs = 0;
  private intervals: { start: number; end: number }[] = [];
  private recent: { at: number; start: number; end: number; work: number }[] = [];
  observe(
    request: Pick<AsrRequest, 'startMs' | 'endMs'>,
    processingMs: number,
    nowMs = request.endMs,
  ) {
    if (!Number.isFinite(processingMs) || processingMs < 0) return this.rtf;
    if (
      !Number.isFinite(request.startMs) ||
      !Number.isFinite(request.endMs) ||
      request.endMs <= request.startMs
    )
      return this.rtf;
    this.recent.push({ at: nowMs, start: request.startMs, end: request.endMs, work: processingMs });
    this.recent = this.recent.filter((row) => nowMs - row.at <= 10000).slice(-256);
    const all = [...this.intervals, { start: request.startMs, end: request.endMs }].sort(
      (a, b) => a.start - b.start,
    );
    const merged: typeof all = [];
    for (const interval of all) {
      const previous = merged.at(-1);
      if (previous && interval.start <= previous.end)
        previous.end = Math.max(previous.end, interval.end);
      else merged.push({ ...interval });
    }
    if (merged.length > 64) {
      this.completedAudioMs += merged
        .slice(0, -64)
        .reduce((sum, item) => sum + item.end - item.start, 0);
    }
    this.intervals = merged.slice(-64);
    this.processingMs += Math.max(0, processingMs);
    return this.rtf;
  }
  get rtf() {
    return (
      this.processingMs /
      Math.max(
        1,
        this.completedAudioMs +
          this.intervals.reduce((sum, item) => sum + item.end - item.start, 0),
      )
    );
  }
  canRunContext(pendingFinal: number, nowMs?: number) {
    return pendingFinal === 0 && this.recentRtf(nowMs) <= 0.6;
  }
  snapshot(queue: readonly { queuedAtMs?: number }[], nowMs: number) {
    return {
      pendingAsr: queue.length,
      rtf: this.recentRtf(nowMs),
      oldestFinalWaitMs: queue.length ? Math.max(0, nowMs - (queue[0].queuedAtMs ?? nowMs)) : 0,
    };
  }
  recentRtf(nowMs = this.recent.at(-1)?.at ?? 0) {
    const rows = this.recent.filter((row) => nowMs - row.at <= 10000);
    const intervals = rows
      .map((row) => ({ start: row.start, end: row.end }))
      .sort((a, b) => a.start - b.start);
    let audio = 0,
      end = -Infinity;
    for (const row of intervals) {
      audio += Math.max(0, row.end - Math.max(end, row.start));
      end = Math.max(end, row.end);
    }
    return rows.reduce((sum, row) => sum + row.work, 0) / Math.max(1, audio);
  }
}
