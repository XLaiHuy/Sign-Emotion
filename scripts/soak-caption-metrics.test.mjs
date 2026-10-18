import { expect, it } from 'vitest';
import { assessCaptionSamples } from './soak-caption-metrics.mjs';

it('accepts 30 final plus one provisional while rejecting 31 final or multiple partials', () => {
  const sample = {
    elapsedMs: 60000,
    captionCounterVersion: 2,
    captionEntryNodes: 31,
    visibleFinalCaptions: 30,
    visibleProvisionalCaptions: 1,
  };
  expect(assessCaptionSamples([sample])).toMatchObject({
    totalEntriesBounded: true,
    semanticCountsBounded: true,
    fullSemanticCoverage: true,
    capReached: true,
  });
  expect(
    assessCaptionSamples([{ ...sample, visibleFinalCaptions: 31, visibleProvisionalCaptions: 0 }])
      .semanticCountsBounded,
  ).toBe(false);
  expect(
    assessCaptionSamples([{ ...sample, visibleFinalCaptions: 29, visibleProvisionalCaptions: 2 }])
      .semanticCountsBounded,
  ).toBe(false);
});

it('preserves legacy raw counts without inferring how many were final', () => {
  const sample = {
    elapsedMs: 60000,
    captionCounterVersion: 1,
    captionEntryNodes: 31,
    visibleFinalCaptions: 31,
  };
  expect(assessCaptionSamples([sample])).toMatchObject({
    totalEntriesBounded: true,
    semanticCountsBounded: false,
    fullSemanticCoverage: false,
    maxMeasuredFinalCaptions: null,
  });
  expect(sample.visibleFinalCaptions).toBe(31);
});

it('does not treat missing/null/inconsistent counters or unknown versions as green evidence', () => {
  const sample = {
    captionCounterVersion: 2,
    captionEntryNodes: 30,
    visibleFinalCaptions: 30,
    visibleProvisionalCaptions: 0,
  };
  expect(
    assessCaptionSamples([{ ...sample, visibleFinalCaptions: null }]).semanticCountsBounded,
  ).toBe(false);
  expect(assessCaptionSamples([{ ...sample, captionEntryNodes: 29 }]).semanticCountsBounded).toBe(
    false,
  );
  expect(assessCaptionSamples([{ ...sample, captionCounterVersion: 3 }]).totalEntriesBounded).toBe(
    false,
  );
  expect(assessCaptionSamples([]).totalEntriesBounded).toBe(false);
});
