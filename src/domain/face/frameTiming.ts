export function elapsedMs(startedAt: number, endedAt: number): number {
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt) return 0;
  return endedAt - startedAt;
}

export function frameLatencyMs(
  capturedAt: number,
  captureMs: number,
  inferenceMs: number,
  displayedAt: number,
): number {
  const measuredPipelineMs = Math.max(0, captureMs) + Math.max(0, inferenceMs);
  return Math.max(measuredPipelineMs, elapsedMs(capturedAt, displayedAt));
}
