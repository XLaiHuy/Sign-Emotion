/** Technical trial gates only; synthetic fixtures do not establish expression accuracy. */
export function resourceGates(report, baselinePrivateBytes) {
  const stages = report.measurements?.stages ?? {};
  const windows = report.measurements?.faceWindows ?? [];
  const memory = report.processMemory?.peakPrivateBytes;
  const fixtureCaptions = report.measurements?.fixtureCaptionLatencies ?? {};
  const queues = report.measurements?.queueSamples ?? [];
  const tail = queues.filter((row) => row.elapsedMs >= report.measurements.elapsedMs - 10000);
  const latency = (name, limit) =>
    stages[name]?.count > 0 && Number.isFinite(stages[name]?.p95Ms) && stages[name].p95Ms <= limit;
  return {
    lifecycle: report.mechanicalChecksPassed === true,
    clock: report.clockValidForLatency === true,
    cadence:
      windows.length > 0 && windows.filter((row) => row.hz >= 4.5).length / windows.length >= 0.95,
    source:
      windows.length > 0 &&
      windows.every((row) => Number.isFinite(row.sourceHz) && row.sourceHz >= 10),
    face: latency('face-label-render', 700),
    partial:
      fixtureCaptions.partial?.count > 0 &&
      Number.isFinite(fixtureCaptions.partial?.p95Ms) &&
      fixtureCaptions.partial.p95Ms <= 1500,
    final:
      fixtureCaptions.final?.count > 0 &&
      Number.isFinite(fixtureCaptions.final?.p95Ms) &&
      fixtureCaptions.final.p95Ms <= 1500,
    rtf:
      report.measurements?.asrWindow?.jobCount > 0 &&
      Number.isFinite(report.measurements?.asrWindow?.rtf) &&
      report.measurements.asrWindow.rtf <= 0.6,
    memory: memory > 0 && baselinePrivateBytes > 0 && memory <= baselinePrivateBytes * 1.1,
    provider: report.measurements?.classifierBackend === 'webgpu',
    queue:
      queues.length > 0 &&
      queues.every((row) => row.pendingFinal <= 3) &&
      tail.length >= 5 &&
      tail.every((row) => row.pendingFinal <= 1 && row.oldestFinalWaitMs < 1000),
  };
}
