import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resourceGates } from './resource-benchmark-gates.mjs';
const root = 'output/research-evaluation/resource-matrix';
mkdirSync(root, { recursive: true });
const profiles = JSON.parse(readFileSync('scripts/moonshine-runtime-profiles.lock.json', 'utf8'));
if (!profiles.single || !profiles.two)
  throw new Error('Build and pin both runtimes before matrix; no substitute thread settings');
const rows = [];
const quality = {};
const npx = join(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    env,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 4,
    timeout: 2400000,
  });
  if (result.error || result.status !== 0) throw new Error('Owned matrix command failed');
  return result;
}
async function deploy(runtime) {
  run(
    'docker',
    [
      'compose',
      '-p',
      'signemo-resources',
      '-f',
      'compose.resources-local.yaml',
      'up',
      '-d',
      '--no-build',
    ],
    { ...process.env, SIGNEMO_RUNTIME: runtime },
  );
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch('http://127.0.0.1:8094/healthz')).ok) return;
    } catch {
      /* bounded startup */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Staging unhealthy');
}
function measure(url, id, seconds = 120) {
  console.log(`Measuring ${id}, ${seconds}s after warm-up`);
  const started = Date.now();
  const result = spawnSync(
    process.execPath,
    ['scripts/browser-pipeline-soak.mjs', url, String(seconds)],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: (seconds + 660) * 1000 },
  );
  writeFileSync(`${root}/${id}.log`, (result.stdout ?? '') + (result.stderr ?? ''));
  // The wrapper may return non-zero for a failed mechanical gate. Keep that observation.
  const path = `output/research-evaluation/pipeline-soak-${seconds}s.json`;
  if (statSync(path).mtimeMs < started) throw new Error('No fresh report; inspect owned CLI log');
  const report = JSON.parse(readFileSync(path, 'utf8'));
  if (
    !report.measurements?.elapsedMs ||
    Date.parse(report.measurements.startedAtUtc ?? '') < started - 60000
  )
    throw new Error('Missing current measurement');
  copyFileSync(path, `${root}/${id}.json`);
  const row = { id, url, seconds, report };
  rows.push(row);
  writeFileSync(`${root}/observations.json`, JSON.stringify(rows, null, 2));
  return row;
}
function evaluateAsr(runtime) {
  const scenario = `${root}/asr-run.js`;
  writeFileSync(
    scenario,
    readFileSync('scripts/browser-moonshine-evaluation.js', 'utf8')
      .trim()
      .replace(/;$/, '')
      .replace('new URL(page.url())', "new URL('http://127.0.0.1:8094/?moonshine=1')"),
  );
  const cli = (...args) =>
    run(process.execPath, [
      npx,
      '--offline',
      '--package',
      '@playwright/cli',
      'playwright-cli',
      '-s=resource-asr',
      ...args,
    ]);
  try {
    cli('open', 'about:blank', '--browser', 'chrome', '--headed');
    const result = cli('run-code', '--filename', scenario);
    writeFileSync(`${root}/asr-${runtime}.log`, result.stdout);
    const path = 'output/research-evaluation/moonshine-public-evaluation.json';
    quality[runtime] = JSON.parse(readFileSync(path, 'utf8'));
    copyFileSync(path, `${root}/asr-${runtime}.json`);
  } finally {
    cli('close');
  }
}
// Build everything before measurements; never overlap compiler load and performance runs.
for (const runtime of ['official', 'single', 'two'])
  run(
    'docker',
    ['compose', '-p', 'signemo-resources', '-f', 'compose.resources-local.yaml', 'build', 'web'],
    { ...process.env, SIGNEMO_RUNTIME: runtime },
  );
const baseline = measure('http://127.0.0.1:8093/?moonshine=1', 'v31-native-control');
const baselineMemory = baseline.report.processMemory?.peakPrivateBytes;
if (!baselineMemory) throw new Error('Missing process-memory baseline');
for (const runtime of ['official', 'single', 'two']) {
  await deploy(runtime);
  evaluateAsr(runtime);
  for (const detector of ['cpu', 'gpu'])
    measure(`http://127.0.0.1:8094/?moonshine=1&detector=${detector}`, `${runtime}-${detector}`);
}
const candidates = rows.slice(1).map((row) => ({
  ...row,
  gates: {
    ...resourceGates(row.report, baselineMemory),
    asrParity:
      quality[row.id.split('-')[0]].wer <= quality.official.wer &&
      quality[row.id.split('-')[0]].cer <= quality.official.cer,
    detector:
      row.report.measurements.detectorDelegate === (row.id.endsWith('-gpu') ? 'GPU' : 'CPU'),
    runtime: row.report.measurements.asrExecutionProfile?.runtime === row.id.split('-')[0],
  },
}));
const eligible = candidates.filter((row) => Object.values(row.gates).every(Boolean));
eligible.sort(
  (a, b) =>
    a.report.measurements.fixtureCaptionLatencies.partial.p95Ms -
      b.report.measurements.fixtureCaptionLatencies.partial.p95Ms ||
    a.report.measurements.stages['face-label-render'].p95Ms -
      b.report.measurements.stages['face-label-render'].p95Ms,
);
const finalists = eligible.slice(0, 2);
for (const row of finalists) {
  const [runtime] = row.id.split('-');
  await deploy(runtime);
  row.repeats = [];
  for (let i = 1; i <= 3; i++) row.repeats.push(measure(row.url, `${row.id}-repeat-${i}`));
}
const consistent = finalists.filter((row) =>
  row.repeats.every((repeat) =>
    Object.values(resourceGates(repeat.report, baselineMemory)).every(Boolean),
  ),
);
const median = (values) => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)];
consistent.sort(
  (a, b) =>
    median(a.repeats.map((row) => row.report.measurements.fixtureCaptionLatencies.partial.p95Ms)) -
    median(b.repeats.map((row) => row.report.measurements.fixtureCaptionLatencies.partial.p95Ms)),
);
const selected = consistent[0] ?? null;
let endurance = null;
let tone = null;
if (selected) {
  await deploy(selected.id.split('-')[0]);
  endurance = measure(selected.url, `${selected.id}-1800s`, 1800);
  if (Object.values(resourceGates(endurance.report, baselineMemory)).every(Boolean)) {
    const toneUrl = new URL(selected.url);
    toneUrl.searchParams.set('tone', '1');
    tone = measure(toneUrl.href, `${selected.id}-tone`, 120);
  }
}
const summary = {
  scope:
    'Local technical performance only. ASR parity must pass separately before selection. No public deployment.',
  baseline: 'v31-native-control',
  tone: tone
    ? { id: tone.id, gates: resourceGates(tone.report, baselineMemory), defaultEnabled: false }
    : null,
  candidates: candidates.map(({ id, gates }) => ({ id, gates })),
  selected:
    selected && Object.values(resourceGates(endurance.report, baselineMemory)).every(Boolean)
      ? selected.id
      : null,
};
writeFileSync(`${root}/summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
