// Own a CLI browser for a local production load test; no physical devices opened.
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { assessCaptionSamples } from './soak-caption-metrics.mjs';

const target = new URL(process.argv[2] ?? 'http://127.0.0.1:8090/');
if (!['localhost', '127.0.0.1'].includes(target.hostname)) throw new Error('Local soak only');
const seconds = Number(process.argv[3] ?? 1800);
const browser = process.env.SIGNEMO_BENCHMARK_BROWSER ?? 'chrome';
if (!['chrome', 'msedge'].includes(browser))
  throw new Error('Supported installed browsers: chrome/msedge');
if (!Number.isInteger(seconds) || seconds < 30 || seconds > 1800)
  throw new Error('Duration must be 30..1800 seconds');
target.searchParams.set('benchmark', '1');
target.searchParams.set('durationSeconds', String(seconds));
const directory = 'output/research-evaluation';
mkdirSync(directory, { recursive: true });
mkdirSync('output/playwright', { recursive: true });
const scenario = 'output/playwright/pipeline-soak-run.js';
const manifest = JSON.parse(readFileSync('output/research-assets/benchmark/manifest.json', 'utf8'));
const pcmBytes = readFileSync('output/research-assets' + manifest.audio.replace('/research', ''));
if (createHash('sha256').update(pcmBytes).digest('hex') !== manifest.audioSha256)
  throw new Error('Public fixture checksum mismatch');
const wav = Buffer.alloc(44 + 7 * 48000 * 2);
wav.write('RIFF');
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(48000, 24);
wav.writeUInt32LE(96000, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(wav.length - 44, 40);
for (let i = 0; i < Math.min(32000, pcmBytes.length / 4); i++) {
  const sample = Math.round(Math.max(-1, Math.min(1, pcmBytes.readFloatLE(i * 4))) * 32767);
  const base = 44 + (144000 + i * 3) * 2;
  wav.writeInt16LE(sample, base);
  wav.writeInt16LE(sample, base + 2);
  wav.writeInt16LE(sample, base + 4);
}
const wavPath = resolve('output/research-assets/benchmark/microphone.wav');
writeFileSync(wavPath, wav);
const config = 'output/playwright/pipeline-chrome.json';
writeFileSync(
  config,
  JSON.stringify({
    browser: {
      launchOptions: {
        args: [
          '--enable-automation',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--use-fake-device-for-media-stream',
          '--use-fake-ui-for-media-stream',
          `--use-file-for-fake-audio-capture=${wavPath}`,
        ],
      },
    },
  }),
);
writeFileSync(
  scenario,
  readFileSync('scripts/browser-pipeline-30min-benchmark.js', 'utf8')
    .trim()
    .replace(/;$/, '')
    .replace('new URL(page.url())', `new URL(${JSON.stringify(target.href)})`),
);
const npx = join(dirname(process.execPath), 'node_modules/npm/bin/npx-cli.js');
const log = join(directory, 'pipeline-soak-cli.log');
writeFileSync(log, '');
function run(...args) {
  const result = spawnSync(
    process.execPath,
    [
      npx,
      '--offline',
      '--package',
      '@playwright/cli',
      'playwright-cli',
      '-s=pipeline-soak',
      ...args,
    ],
    {
      encoding: 'utf8',
      timeout: (seconds + 600) * 1000,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  writeFileSync(log, (result.stdout ?? '') + (result.stderr ?? ''), { flag: 'a' });
  if (result.status !== 0)
    throw new Error('Owned browser CLI failed; inspect local soak log before retrying');
}
let sampler;
const memoryPath = join(directory, 'pipeline-process-memory.json');
const stopMemory = join(directory, 'pipeline-memory-stop.signal');
try {
  run('open', 'about:blank', '--browser', browser, '--headed', '--config', config);
  if (existsSync(stopMemory)) unlinkSync(stopMemory);
  if (existsSync(memoryPath)) unlinkSync(memoryPath);
  sampler = spawn(
    'powershell.exe',
    [
      '-NoProfile',
      '-File',
      'scripts/sample-browser-memory.ps1',
      '-Session',
      'pipeline-soak',
      '-Seconds',
      String(Math.min(2400, seconds + 300)),
      '-OutputFile',
      memoryPath,
      '-StopFile',
      stopMemory,
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  // Identify the dedicated browser before the long CLI scenario occupies the session.
  const memoryReadyBy = Date.now() + 30000;
  while (!existsSync(memoryPath) && sampler.exitCode === null && Date.now() < memoryReadyBy)
    await new Promise((resolve) => setTimeout(resolve, 100));
  if (!existsSync(memoryPath)) throw new Error('Owned process-memory sampler did not start');
  console.log(`Owned local browser running; requested ${seconds} seconds after preparation.`);
  run('run-code', '--filename', scenario);
  const path = join(
    directory,
    target.searchParams.get('history') === '1'
      ? 'pipeline-history-benchmark.json'
      : 'pipeline-benchmark.json',
  );
  const report = JSON.parse(readFileSync(path, 'utf8'));
  writeFileSync(stopMemory, 'stop');
  if (sampler.exitCode === null) {
    await Promise.race([
      new Promise((resolve) => sampler.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
  }
  // Child receives an explicit stop signal; retain sampled process memory separately from JS heap.
  if (existsSync(memoryPath)) {
    try {
      report.processMemory = JSON.parse(readFileSync(memoryPath, 'utf8').replace(/^\uFEFF/, ''));
    } catch {
      report.processMemory = null;
    }
  }
  const samples = report.measurements?.samples ?? [];
  report.captionMeasurements = assessCaptionSamples(samples);
  const measured = samples.filter(
    (sample) =>
      sample.captionCounterVersion === 2 &&
      sample.elapsedMs >= 300000 &&
      sample.visibleFinalCaptions === 30,
  );
  const points = measured.map((sample) => [
    sample.elapsedMs / 60000,
    sample.cdpHeapUsedBytes / 1048576,
  ]);
  let slope = null;
  if (points.length >= 3) {
    const x = points.reduce((sum, point) => sum + point[0], 0) / points.length;
    const y = points.reduce((sum, point) => sum + point[1], 0) / points.length;
    slope =
      points.reduce((sum, point) => sum + (point[0] - x) * (point[1] - y), 0) /
      points.reduce((sum, point) => sum + (point[0] - x) ** 2, 0);
  }
  report.memoryObservation = {
    samples: samples.length,
    warmedSamples: points.length,
    mainRendererHeapSlopeMiBPerMinute: slope,
    maxMainRendererHeapBytes: Math.max(0, ...samples.map((sample) => sample.cdpHeapUsedBytes)),
    maxAttachedElements: Math.max(0, ...samples.map((sample) => sample.attachedDomElements)),
    maxFinalCaptionNodes: Math.max(0, ...samples.map((sample) => sample.visibleFinalCaptions)),
    captionCapReached: samples.some((sample) => sample.visibleFinalCaptions === 30),
    noLeakProven: false,
  };
  report.mechanicalChecksPassed =
    report.status === 'completed' &&
    report.measurements?.elapsedMs >= seconds * 1000 &&
    report.applicationTeardownPassed &&
    report.finishTeardownPassed &&
    report.teardownPassed &&
    report.pageErrors === 0 &&
    report.measurements.workerErrors === 0 &&
    report.network.nonGet === 0 &&
    report.network.external === 0 &&
    samples.length >= Math.floor(seconds / 60) + 1 &&
    report.captionMeasurements.fullSemanticCoverage &&
    report.captionMeasurements.totalEntriesBounded &&
    report.captionMeasurements.semanticCountsBounded &&
    (seconds < 1800 || report.memoryObservation.captionCapReached);
  const final = join(
    directory,
    `pipeline-${target.searchParams.get('history') === '1' ? 'history-' : ''}soak-${seconds}s.json`,
  );
  writeFileSync(final, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      report: final,
      status: report.status,
      mechanicalChecksPassed: report.mechanicalChecksPassed,
      teardownPassed: report.teardownPassed,
      memoryObservation: report.memoryObservation,
    }),
  );
  if (!report.mechanicalChecksPassed) process.exitCode = 1;
} finally {
  writeFileSync(stopMemory, 'stop');
  if (sampler && sampler.exitCode === null) {
    await Promise.race([
      new Promise((resolve) => sampler.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
    if (sampler.exitCode === null) sampler.kill();
  }
  run('close');
}
