import { readFile, writeFile, access } from 'node:fs/promises';
import {
  baselineFusion,
  fuse,
  FusionRhythmGate,
  speechFusionCandidates,
} from '../src/domain/conversation.ts';
const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw new Error('Usage: node scripts/evaluate-fusion.mjs dataset.json report.json');
const dataset = JSON.parse(await readFile(input, 'utf8'));
if (
  dataset.schemaVersion !== 1 ||
  dataset.encryptedStorageConfirmed !== true ||
  dataset.researchConsent !== true ||
  !dataset.license
)
  throw new Error('Research rights/consent/encrypted storage confirmation required');
const labels = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'fear', 'disgust'];
const participants = new Map();
const sessions = new Map();
for (const row of dataset.rows) {
  const consent = Date.parse(row.consentedAt),
    expiry = Date.parse(row.expiresAt);
  if (
    !Number.isFinite(consent) ||
    !Number.isFinite(expiry) ||
    consent > Date.now() ||
    expiry <= Date.now() ||
    expiry - consent > 30 * 86400000 + 1000 ||
    row.rightsVerified !== true
  )
    throw new Error('Expired or unverified research consent');
  if (
    !['validation', 'test'].includes(row.split) ||
    !labels.includes(row.reference) ||
    !Array.isArray(row.evidence) ||
    !row.participantId ||
    !row.sessionId ||
    !Number.isFinite(row.segment.startMs) ||
    !Number.isFinite(row.segment.endMs) ||
    row.segment.endMs <= row.segment.startMs ||
    !Number.isFinite(row.decidedAtMs) ||
    row.decidedAtMs < row.segment.endMs
  )
    throw new Error('Invalid reference/timestamp row');
  if (participants.has(row.participantId) && participants.get(row.participantId) !== row.split)
    throw new Error('Participant leakage');
  participants.set(row.participantId, row.split);
  if (sessions.has(row.sessionId) && sessions.get(row.sessionId) !== row.participantId)
    throw new Error('Session belongs to multiple participants');
  sessions.set(row.sessionId, row.participantId);
}
const validation = dataset.rows.filter((row) => row.split === 'validation');
const test = dataset.rows.filter((row) => row.split === 'test');
if (test.length) {
  let exists = false;
  try {
    await access(output);
    exists = true;
  } catch {
    /* first report */
  }
  if (exists) throw new Error('Held-out report already exists; do not retune after viewing test');
}
if (!validation.length)
  throw new Error('Validation required; held-out test is not used to choose weights');
function evaluate(rows, profile) {
  const gates = new Map(),
    intervals = new Map();
  let falseCues = 0,
    decided = 0;
  const predicted = [];
  for (const row of [...rows].sort((a, b) => a.decidedAtMs - b.decidedAtMs)) {
    const decision = fuse(row.segment, row.evidence, profile);
    predicted.push({ reference: row.reference, label: decision.label });
    if (decision.label) decided++;
    if (!gates.has(row.sessionId)) gates.set(row.sessionId, new FusionRhythmGate());
    const cue = gates.get(row.sessionId).update(decision, row.decidedAtMs, 3000, row.segment.endMs);
    if (cue && cue !== row.reference) falseCues++;
    const span = intervals.get(row.sessionId) ?? {
      start: row.segment.startMs,
      end: row.segment.endMs,
    };
    span.start = Math.min(span.start, row.segment.startMs);
    span.end = Math.max(span.end, row.segment.endMs);
    intervals.set(row.sessionId, span);
  }
  const perClass = Object.fromEntries(
    labels.map((label) => {
      const tp = predicted.filter((r) => r.reference === label && r.label === label).length;
      const fp = predicted.filter((r) => r.reference !== label && r.label === label).length;
      const fn = predicted.filter((r) => r.reference === label && r.label !== label).length;
      const precision = tp / Math.max(1, tp + fp),
        recall = tp / Math.max(1, tp + fn);
      return [
        label,
        {
          precision,
          recall,
          support: tp + fn,
          f1: (2 * precision * recall) / Math.max(1e-12, precision + recall),
        },
      ];
    }),
  );
  const minutes =
    [...intervals.values()].reduce((sum, span) => sum + span.end - span.start, 0) / 60000;
  return {
    macroF1: labels.reduce((sum, label) => sum + perClass[label].f1, 0) / labels.length,
    perClass,
    coverage: decided / Math.max(1, rows.length),
    abstention: 1 - decided / Math.max(1, rows.length),
    falseCuesPerMinute: falseCues / Math.max(minutes, 1e-9),
    rows: rows.length,
  };
}
const ablations = [
  ['face', { face: 1, text: 0, voice: 0 }],
  ['text', { face: 0, text: 1, voice: 0 }],
  ['voice', { face: 0, text: 0, voice: 1 }],
  ['face-text', { face: 1, text: 1, voice: 0 }],
  ['text-voice', { face: 0, text: 1, voice: 1 }],
  ['face-voice', { face: 1, text: 0, voice: 1 }],
].map(([name, weights]) => ({ name, profile: { ...baselineFusion, weights } }));
// Single-source ablations measure a classifier vote directly; fusion still requires two sources.
function branchMetrics(rows, source) {
  const duplicated = rows.map((row) => {
    const evidence = row.evidence.filter((item) => item.source === source);
    return {
      ...row,
      evidence: evidence.flatMap((item) => [
        { ...item, source: 'face' },
        { ...item, source: 'text' },
      ]),
    };
  });
  const result = evaluate(duplicated, baselineFusion);
  return {
    ...result,
    falseCuesPerMinute: null,
    scope: 'single-source prediction only; no rhythm emission',
  };
}
// Calibrate pairs on the same validation grid as triples; otherwise a gain
// could come from threshold tuning alone rather than the extra modality.
const pairReports = ablations.slice(3).map((item) => {
  const sources = Object.entries(item.profile.weights)
    .filter(([, weight]) => weight > 0)
    .map(([source]) => source);
  const options = [];
  for (const first of [0.55, 0.65, 0.75, 0.85])
    for (const second of [0.55, 0.65, 0.75, 0.85]) {
      const profile = {
        ...item.profile,
        thresholds: { ...item.profile.thresholds, [sources[0]]: first, [sources[1]]: second },
      };
      options.push({ name: item.name, profile, validation: evaluate(validation, profile) });
    }
  options.sort(
    (a, b) =>
      b.validation.macroF1 - a.validation.macroF1 ||
      a.validation.falseCuesPerMinute - b.validation.falseCuesPerMinute,
  );
  return options[0];
});
pairReports.sort((a, b) => b.validation.macroF1 - a.validation.macroF1);
const bestPair = pairReports[0];
const candidates = [];
for (const base of speechFusionCandidates)
  for (const face of [0.55, 0.65, 0.75, 0.85])
    for (const text of [0.55, 0.65, 0.75, 0.85])
      for (const voice of [0.55, 0.65, 0.75, 0.85]) {
        const profile = { ...base, thresholds: { face, text, voice } };
        const metrics = evaluate(validation, profile);
        const passes =
          metrics.macroF1 >= bestPair.validation.macroF1 + 0.03 &&
          ['sad', 'angry'].every(
            (label) =>
              metrics.perClass[label].precision >= bestPair.validation.perClass[label].precision,
          ) &&
          metrics.falseCuesPerMinute <= bestPair.validation.falseCuesPerMinute;
        candidates.push({ profile, metrics, passes });
      }
candidates.sort(
  (a, b) =>
    Number(b.passes) - Number(a.passes) ||
    b.metrics.macroF1 - a.metrics.macroF1 ||
    b.metrics.coverage - a.metrics.coverage,
);
const selected = candidates[0];
const heldOut = test.length ? evaluate(test, selected.profile) : null;
const heldOutPair = test.length ? evaluate(test, bestPair.profile) : null;
const completeLabels = [validation, test].every((rows) =>
  labels.every((label) => rows.some((row) => row.reference === label)),
);
const heldOutPassed = Boolean(
  heldOut &&
  heldOutPair &&
  completeLabels &&
  selected.passes &&
  heldOut.macroF1 >= heldOutPair.macroF1 + 0.03 &&
  ['sad', 'angry'].every(
    (label) => heldOut.perClass[label].precision >= heldOutPair.perClass[label].precision,
  ) &&
  heldOut.falseCuesPerMinute <= heldOutPair.falseCuesPerMinute,
);
const report = {
  status: 'research-only',
  participantDisjoint: true,
  validationSelected: true,
  selectedProfile: selected.profile,
  validation: selected.metrics,
  validationQualityPassed: selected.passes,
  ablations: ablations.map((item) => ({
    name: item.name,
    validation: ['face', 'text', 'voice'].includes(item.name)
      ? branchMetrics(validation, item.name)
      : evaluate(validation, item.profile),
  })),
  bestPair: bestPair.name,
  calibratedPairs: pairReports,
  heldOut,
  heldOutPair,
  heldOutQualityPassed: heldOutPassed,
  promotionAllowed: false,
  remainingGates: [
    'PC browser 30-minute performance',
    'runtime/memory/download budget',
    'user pilot',
  ],
  note: 'Text and voice are correlated. Weighted agreement is not a probability of true emotion. No media/transcripts/participant IDs in this report.',
  weightInterpretation:
    'With unanimous eligible votes and no fused-score cutoff, weights change the displayed score, not the chosen label. Equal classification metrics do not prove a particular ratio optimal.',
};
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log('Aggregate fusion/ablation report written. No automatic production promotion.');
