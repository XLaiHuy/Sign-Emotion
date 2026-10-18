import { describe, expect, it } from 'vitest';
import {
  fuse,
  baselineFusion,
  FusionRhythmGate,
  FaceInferenceBudget,
  temporalIoU,
  type ModalityEvidence,
} from '../src/domain/conversation';
import { StreamingResampler, UtteranceBuilder } from '../src/domain/audio';
import { FaceWindow } from '../src/features/conversation/session';
import { emptyResult } from '../src/domain/face/prediction';
import { reviseCaption } from '../src/domain/captionRevision';
const segment = { id: 'utterance', startMs: 1000, endMs: 3000 };
const evidence = (source: ModalityEvidence['source'], label = 'sad'): ModalityEvidence => ({
  source,
  startMs: 1000,
  endMs: 3000,
  scores: { [label]: 0.85 },
  unsupportedScore: 0.15,
  quality: 'usable',
  modelVersion: 'test',
});
describe('time-aligned conservative fusion', () => {
  it('rejects sparse/adjacent face intervals and accepts the 40 percent overlap boundary', () => {
    expect(temporalIoU(segment, { startMs: 3000, endMs: 4000 })).toBe(0);
    expect(temporalIoU(segment, { startMs: NaN, endMs: 3000 })).toBe(0);
    expect(
      fuse(segment, [{ ...evidence('face'), endMs: 1700 }, evidence('text')]).label,
    ).toBeNull();
    expect(fuse(segment, [{ ...evidence('face'), endMs: 1800 }, evidence('text')]).label).toBe(
      'sad',
    );
    const window = new FaceWindow();
    for (const timestamp of [1000, 1500])
      window.add({
        ...emptyResult(),
        timestamp,
        status: 'valid',
        scores: [0.1, 0.02, 0.02, 0.8, 0.02, 0.02, 0.01, 0.01],
      });
    expect(
      window.evidence({
        ...segment,
        text: '',
        modelVersion: 'test',
        processingMs: 0,
        finalizedAtMs: 4000,
      }),
    ).toBeNull();
  });
  it('accepts the sensitive demo threshold but still rejects ambiguity and disagreement', () => {
    const moderate = (source: ModalityEvidence['source'], label = 'angry'): ModalityEvidence => ({
      ...evidence(source),
      scores: { [label]: 0.56, neutral: 0.3 },
      unsupportedScore: 0.14,
    });
    expect(fuse(segment, [moderate('face'), moderate('text')]).label).toBe('angry');
    expect(fuse(segment, [moderate('face'), moderate('text', 'fear')]).reason).toBe('conflict');
    expect(
      fuse(segment, [
        moderate('face'),
        {
          ...moderate('text'),
          scores: { angry: 0.54, neutral: 0.32 },
        },
      ]).reason,
    ).toBe('low-score');
    expect(fuse(segment, [moderate('face')]).label).toBeNull();
  });
  it('requires two agreeing distinct modalities and rejects high-quality conflicts', () => {
    expect(fuse(segment, [evidence('face')]).label).toBeNull();
    expect(fuse(segment, [evidence('face'), evidence('face')]).label).toBeNull();
    expect(fuse(segment, [evidence('face'), evidence('text')]).label).toBe('sad');
    expect(fuse(segment, [evidence('face'), evidence('text', 'happy')]).reason).toBe('conflict');
  });
  it('excludes non-overlapping, rejected and unsupported-dominant evidence', () => {
    expect(
      fuse(segment, [evidence('face'), { ...evidence('text'), startMs: 4000, endMs: 5000 }]).label,
    ).toBeNull();
    expect(
      fuse(segment, [evidence('face'), { ...evidence('text'), quality: 'rejected' }]).label,
    ).toBeNull();
    expect(
      fuse(segment, [
        evidence('face'),
        { ...evidence('text'), scores: { sad: 0.4 }, unsupportedScore: 0.6 },
      ]).label,
    ).toBeNull();
    expect(
      fuse(segment, [evidence('face'), { ...evidence('text'), scores: { sad: NaN } }]).label,
    ).toBeNull();
  });
  it('weights only eligible evidence and marks the baseline experimental', () => {
    const result = fuse(
      segment,
      [evidence('face'), { ...evidence('text'), scores: { sad: 0.7 }, unsupportedScore: 0.3 }],
      { ...baselineFusion, weights: { face: 1, text: 3 } },
    );
    expect(result.score).toBeCloseTo(0.7375);
    expect(result.experimental).toBe(true);
  });
  it('deduplicates transcript revisions, holds expression and applies cooldown', () => {
    const gate = new FusionRhythmGate();
    const sad = fuse(segment, [evidence('face'), evidence('text')]);
    expect(gate.update(sad, 1000)).toBe('sad');
    expect(gate.update(sad, 5000)).toBeNull();
    expect(gate.update({ ...sad, segmentId: 'another' }, 5000)).toBeNull();
    gate.update({ ...sad, segmentId: 'neutral', label: 'neutral' }, 6000);
    expect(gate.update({ ...sad, segmentId: 'after-neutral' }, 6500)).toBe('sad');
    expect(gate.update({ ...sad, segmentId: 'angry', label: 'angry' }, 7000)).toBeNull();
  });
});
describe('audio boundaries', () => {
  it('preserves streaming phase and suppresses frequencies above the target Nyquist', () => {
    const count = 48000;
    const tone = (hz: number) =>
      Float32Array.from({ length: count }, (_, i) => Math.sin((2 * Math.PI * hz * i) / 48000));
    const resample = (input: Float32Array, block: number) => {
      const converter = new StreamingResampler(48000);
      const parts: number[] = [];
      for (let i = 0; i < input.length; i += block)
        parts.push(...converter.push(input.slice(i, i + block)));
      return parts;
    };
    const low = resample(tone(1000), 128),
      whole = resample(tone(1000), 48000),
      high = resample(tone(12000), 128);
    expect(low.length).toBeGreaterThan(15980);
    expect(low).toEqual(whole);
    const rms = (values: number[]) =>
      Math.sqrt(values.slice(100).reduce((sum, v) => sum + v * v, 0) / (values.length - 100));
    expect(rms(high)).toBeLessThan(rms(low) * 0.05);
  });
  it('does not produce silence captions, retains pre-roll and flushes speech at end', () => {
    const builder = new UtteranceBuilder();
    const frame = new Float32Array(512).fill(0.1);
    for (let i = 0; i < 50; i++) expect(builder.push(frame, 0, i * 512)).toBeNull();
    for (let i = 50; i < 60; i++) expect(builder.push(frame, 0.9, i * 512)).toBeNull();
    const chunk = builder.flush()!;
    expect(chunk.startSample).toBe(44 * 512);
    expect(chunk.endSample).toBe(60 * 512);
    expect(chunk.samples.length).toBe(16 * 512);
    expect(builder.flush()).toBeNull();
  });
  it('estimates local speech/noise quality and bounds long speech near three seconds', () => {
    const builder = new UtteranceBuilder();
    const noise = new Float32Array(512).fill(0.001);
    const speech = new Float32Array(512).fill(0.1);
    for (let i = 0; i < 6; i++) builder.push(noise, 0, i * 512);
    let chunk = null;
    for (let i = 6; i < 100; i++) chunk = builder.push(speech, 0.9, i * 512) ?? chunk;
    expect(chunk?.samples.length).toBe(94 * 512);
    expect(chunk?.quality.speechRms).toBeCloseTo(0.1);
    expect(chunk?.quality.noiseRms).toBeCloseTo(0.001);
    expect(chunk?.quality.clippingRatio).toBe(0);
  });
});
describe('constrained caption revision', () => {
  it('normalizes spacing without changing Vietnamese diacritics or words', () => {
    expect(reviseCaption('  Tôi   rất vui !  ').text).toBe('Tôi rất vui!');
  });
  it('removes only an exact multi-word overlap at a segment boundary and preserves the source', () => {
    expect(reviseCaption('với bạn nhé', ['Mình muốn nói với bạn']).text).toBe('với bạn nhé');
    const revised = reviseCaption('với bạn nhé', ['Mình muốn nói với bạn'], {
      previousEndMs: 3200,
      currentStartMs: 3000,
      sameUtterance: true,
    });
    expect(revised.text).toBe('nhé');
    expect(revised).toMatchObject({ original: 'với bạn nhé', changed: true, revision: 1 });
  });
  it('keeps negation and numbers intact when context differs', () => {
    expect(reviseCaption('Tôi không vui 2 ngày', ['Tôi vui một ngày']).text).toBe(
      'Tôi không vui 2 ngày',
    );
  });
});
it('aggregates face evidence during speech rather than after ASR finishes', () => {
  const window = new FaceWindow();
  for (const timestamp of [1000, 1500, 2000])
    window.add({
      ...emptyResult(),
      timestamp,
      label: 'sad',
      status: 'valid',
      scores: [0.1, 0.02, 0.02, 0.8, 0.02, 0.02, 0.01, 0.01],
    });
  window.add({
    ...emptyResult(),
    timestamp: 5000,
    label: 'happy',
    status: 'valid',
    scores: [0.1, 0.8, 0.02, 0.02, 0.02, 0.02, 0.01, 0.01],
  });
  expect(
    window.evidence({
      ...segment,
      text: 'test',
      processingMs: 1,
      finalizedAtMs: 5000,
      modelVersion: 'test',
    })?.scores.sad,
  ).toBeCloseTo(0.8);
  window.reset(2500);
  expect(
    window.evidence({
      ...segment,
      startMs: 1000,
      endMs: 3000,
      text: 'test',
      processingMs: 1,
      finalizedAtMs: 3000,
      modelVersion: 'test',
    }),
  ).toBeNull();
});
it('reduces face sampling under load and recovers one step after ten healthy seconds', () => {
  const budget = new FaceInferenceBudget();
  expect(budget.update(0, 0, 0.1, 20)).toBe(200);
  expect(budget.update(5000, 1, 0.9, 20)).toBe(200);
  expect(budget.update(10000, 2, 0.9, 20)).toBe(200);
  expect(budget.update(12000, 2, 0.9, 20)).toBe(500);
  expect(budget.update(15000, 0, 0.4, 20)).toBe(500);
  expect(budget.update(25000, 0, 0.4, 20)).toBe(200);
});

it('keeps face cadence through single finals and requires sustained real backlog', () => {
  const budget = new FaceInferenceBudget();
  expect(budget.update(0, 1, 0.3, 40)).toBe(200);
  expect(budget.update(500, 0, 0.3, 40)).toBe(200);
  expect(budget.update(5000, 1, 0.3, 40)).toBe(200);
  expect(budget.update(5500, 0, 0.3, 40)).toBe(200);
  expect(budget.update(6000, 2, 0.3, 40)).toBe(200);
  expect(budget.update(8000, 3, 1.1, 40)).toBe(500);
  expect(budget.update(10000, 3, 1.1, 40)).toBe(1000);
});
