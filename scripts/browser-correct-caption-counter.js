// A correction to benchmark instrumentation, never application/media state.
async (page) => {
  if (!['localhost', '127.0.0.1'].includes(new URL(page.url()).hostname))
    throw new Error('Owned local benchmark only');
  return page.evaluate(() => {
    const bench = window.pipelineBench;
    if (!bench?.startedAt || bench.stopped || bench.captionCounterCorrection)
      throw new Error('No active uncorrected benchmark');
    const correction = {
      atElapsedMs: performance.now() - bench.startedAt,
      previousSamples: bench.samples.length,
      legacyFieldMeaning: 'visibleFinalCaptions previously counted all caption-entry nodes, including provisional',
      applicationChanged: false,
      historicalMeasurementsChanged: false,
    };
    for (const sample of bench.samples) {
      sample.captionCounterVersion = 1;
      sample.captionEntryNodes = sample.visibleFinalCaptions;
    }
    const originalSnapshot = bench.snapshot;
    bench.snapshot = () => ({
      ...originalSnapshot(),
      captionCounterVersion: 2,
      captionEntryNodes: document.querySelectorAll('.caption-entry').length,
      visibleFinalCaptions: document.querySelectorAll('.caption-entry:not(.provisional-caption)').length,
      visibleProvisionalCaptions: document.querySelectorAll('.caption-entry.provisional-caption').length,
    });
    bench.captionCounterCorrection = correction;
    const originalReport = bench.report;
    bench.report = () => ({ ...originalReport(), captionCounterCorrection: correction });
    return { correction, current: bench.snapshot() };
  });
};
