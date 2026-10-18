// Evidence validation only: never repair/guess historical measurements.
const count = (value) => Number.isInteger(value) && value >= 0;
export function assessCaptionSamples(samples) {
  const semantic = samples.filter((sample) => sample.captionCounterVersion === 2);
  const legacy = samples.filter(
    (sample) => sample.captionCounterVersion === 1 || sample.captionCounterVersion === undefined,
  );
  const unknown = samples.length - semantic.length - legacy.length;
  const totalEntriesBounded =
    samples.length > 0 &&
    unknown === 0 &&
    samples.every((sample) => {
      const total =
        sample.captionEntryNodes ??
        (sample.captionCounterVersion !== 2 ? sample.visibleFinalCaptions : undefined);
      return count(total) && total <= 31;
    });
  const semanticCountsBounded =
    semantic.length > 0 &&
    semantic.every(
      (sample) =>
        count(sample.visibleFinalCaptions) &&
        sample.visibleFinalCaptions <= 30 &&
        count(sample.visibleProvisionalCaptions) &&
        sample.visibleProvisionalCaptions <= 1 &&
        sample.captionEntryNodes ===
          sample.visibleFinalCaptions + sample.visibleProvisionalCaptions,
    );
  return {
    sampleCount: samples.length,
    semanticSamples: semantic.length,
    legacySamples: legacy.length,
    unknownSamples: unknown,
    totalEntriesBounded,
    semanticCountsBounded,
    fullSemanticCoverage: samples.length > 0 && semantic.length === samples.length,
    capReached: semantic.some((sample) => sample.visibleFinalCaptions === 30),
    maxMeasuredFinalCaptions: semantic.length
      ? Math.max(...semantic.map((sample) => sample.visibleFinalCaptions))
      : null,
    maxMeasuredProvisionalCaptions: semantic.length
      ? Math.max(...semantic.map((sample) => sample.visibleProvisionalCaptions))
      : null,
    semanticFirstElapsedMs: semantic[0]?.elapsedMs ?? null,
    semanticLastElapsedMs: semantic.at(-1)?.elapsedMs ?? null,
  };
}
