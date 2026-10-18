async (page) => {
  const reference = __REFERENCE__;
  const workerPath = __WORKER__;
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
  await page.getByRole('button', { name: 'Mở phòng kiểm thử tiếng nói' }).click();
  await page.getByLabel('Chọn WAV/MP3/WebM').setInputFiles('output/evaluation/parity.wav');
  const run = async target => target.evaluate(async ({ reference, workerPath }) => {
    const file = document.querySelector('input[type=file]').files[0];
    const context = new AudioContext({ sampleRate: 16000 });
    const audio = await context.decodeAudioData(await file.arrayBuffer());
    await context.close();
    if (audio.sampleRate !== 16000 || audio.length !== reference.samples) throw new Error('Parity waveform/sample-rate mismatch');
    const worker = new Worker(workerPath, { type: 'module' });
    const started = performance.now();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { worker.terminate(); reject(new Error('Parity timeout')); }, 120000);
      const stop = () => { clearTimeout(timeout); worker.terminate(); };
      worker.onerror = e => { stop(); reject(new Error(e.message)); };
      worker.onmessage = e => {
        if (e.data.type === 'error') { stop(); reject(new Error(e.data.message)); }
        if (e.data.type === 'ready') {
          const samples = audio.getChannelData(0).slice();
          worker.postMessage({ type: 'infer', id: 'parity', text: reference.text, startMs: 0, endMs: 4000 });
        }
        if (e.data.type === 'result') { stop(); resolve({ evidence: e.data.evidence, elapsedMs: performance.now() - started }); }
      };
      worker.postMessage({ type: 'init' });
    });
  }, { reference, workerPath });
  const online = await run(page);
  const mapping = { Enjoyment: 'happy', Sadness: 'sad', Anger: 'angry', Surprise: 'surprised', ANG: 'angry', HAP: 'happy', NEU: 'neutral', SAD: 'sad', SUR: 'surprised' };
  const deltas = {};
  for (const source of ['text']) {
    const expected = { unsupportedScore: 0 };
    reference[source + 'Labels'].forEach((name, i) => {
      const label = mapping[name];
      if (label) expected[label] = (expected[label] ?? 0) + reference[source + 'Probabilities'][i];
      else expected.unsupportedScore += reference[source + 'Probabilities'][i];
    });
    const actual = online.evidence.find(item => item.source === source);
    deltas[source] = Math.max(...Object.entries(expected).map(([key, value]) => Math.abs(value - (key === 'unsupportedScore' ? actual.unsupportedScore : actual.scores[key] ?? 0))));
    if (deltas[source] > 0.03) throw new Error(JSON.stringify({ source, delta: deltas[source], expected, actual }));
  }
  await page.context().setOffline(true);
  let offline;
  const reopened = await page.context().newPage();
  try {
    await reopened.goto(page.url());
    await reopened.getByRole('heading', { name: 'Ở đây, mình hiểu nhau.' }).waitFor();
    await reopened.getByRole('button', { name: 'Cài đặt', exact: true }).click();
    await reopened.getByRole('button', { name: 'Mở phòng kiểm thử tiếng nói' }).click();
    await reopened.getByLabel('Chọn WAV/MP3/WebM').setInputFiles('output/evaluation/parity.wav');
    offline = await run(reopened);
    await reopened.getByRole('button', { name: 'Chạy kiểm thử tiếng Việt', exact: true }).click();
    await reopened.getByRole('button', { name: 'Chạy kiểm thử tiếng Việt', exact: true }).waitFor({ timeout: 120000 });
    if (await reopened.locator('.settings-card .error-box').count()) throw new Error(await reopened.locator('.settings-card .error-box').innerText());
    await reopened.locator('.speech-lab-result').waitFor();
  } finally { await reopened.close(); await page.context().setOffline(false); }
  return { deltas, tolerance: 0.03, online, offlineTextEmotionInitialized: offline.evidence.length === 1, offlineAsrInitialized: true, scope: 'runtime parity and offline, not emotion accuracy' };
}
