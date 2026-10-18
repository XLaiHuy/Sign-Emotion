/** Nearest-rank statistics; timings are observed samples, never an SLA. */
export function timingSummary(values: number[]) {
  const sorted = values.filter((v) => Number.isFinite(v) && v >= 0).sort((a, b) => a - b);
  const percentile = (p: number) =>
    sorted.length ? sorted[Math.ceil(p * sorted.length) - 1] : null;
  return { samples: sorted.length, p50Ms: percentile(0.5), p95Ms: percentile(0.95) };
}
