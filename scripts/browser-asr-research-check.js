async function researchAsrCheck(page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.setBypassServiceWorker', { bypass: true });
  await page.goto('http://localhost:8081/healthz');
  await page.evaluate(async () => {
    for (const registration of await navigator.serviceWorker.getRegistrations())
      await registration.unregister();
  });
  await page.goto('about:blank');
  await page.goto('http://localhost:8081/healthz?research-isolated=1');
  const isolated = await page.evaluate(() => !document.querySelector('#root'));
  if (!isolated) throw new Error('Benchmark page must not run the application pipeline');
  await cdp.detach();
  const requests = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET' || new URL(request.url()).origin !== 'http://localhost:8081')
      requests.push({ method: request.method(), origin: new URL(request.url()).origin });
  });
  const report = await page.evaluate(async () => {
    const fixture = await (await fetch('/research/evaluation/manifest.json')).json();
    const html = await (await fetch('/')).text();
    const entry = html.match(/src="([^"]+\.js)"/)[1];
    const source = await (await fetch(entry)).text();
    const workerUrl = source.match(/\/assets\/speech\.worker-[A-Za-z0-9_-]+\.js/)[0];
    const results = [];
    const windows = [];
    for (const profile of ['phowhisper', 'gipformer-research']) {
      const worker = new Worker(workerUrl, { type: 'module' });
      const send = (message, expected, transfer = []) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            worker.terminate();
            reject(new Error('Worker timeout'));
          }, 180000);
          worker.onmessage = (event) => {
            if (event.data.type === expected || event.data.type === 'error') {
              clearTimeout(timer);
              if (event.data.type === 'error') reject(new Error(event.data.message));
              else resolve(event.data);
            }
          };
          worker.onerror = () => {
            clearTimeout(timer);
            reject(new Error('Worker startup failed'));
          };
          worker.postMessage(message, transfer);
        });
      const started = performance.now();
      try {
        const ready = await send({ type: 'init', profile }, 'ready');
        const preparationMs = performance.now() - started;
        for (const [index, item] of fixture.samples.entries()) {
          const bytes = await (await fetch(item.url)).arrayBuffer();
          const samples = new Float32Array(bytes);
          const result = await send(
            {
              type: 'transcribe',
              id: String(index),
              samples,
              startMs: 0,
              endMs: item.seconds * 1000,
            },
            'result',
            [samples.buffer],
          );
          results.push({
            profile,
            preparationMs,
            ready,
            reference: item.reference,
            pythonText: item.pythonText,
            pythonMs: item.pythonMs,
            seconds: item.seconds,
            segment: result.segment,
          });
        }
        const pcm = new Float32Array(await (await fetch(fixture.samples[0].url)).arrayBuffer());
        const decodes = [];
        for (const [index, milliseconds] of [800, 1600, 3000].entries()) {
          const samples = pcm.slice(0, milliseconds * 16),
            final = index === 2;
          const value = await send(
            {
              type: final ? 'transcribe' : 'interim',
              id: 'window-smoke',
              revision: index + 1,
              samples,
              startMs: 0,
              endMs: milliseconds,
            },
            final ? 'result' : 'partial',
            [samples.buffer],
          );
          decodes.push({ windowMs: milliseconds, decodeMs: value.segment.processingMs, final });
        }
        windows.push({
          profile,
          decodes,
          effectiveRTF: decodes.reduce((sum, item) => sum + item.decodeMs, 0) / 3000,
          scope: 'Preloaded PCM windows, not measured live microphone latency',
        });
      } catch (error) {
        results.push({ profile, failed: true, error: error.name, stage: 'browser-wasm' });
      } finally {
        worker.terminate();
      }
    }
    return {
      dataset: fixture.dataset,
      license: fixture.license,
      source: fixture.source,
      browser: navigator.userAgent,
      windows,
      scope:
        'Five public read-speech clips, exact PCM, isolated browser workers. Not simultaneous camera/text/tone, physical microphone or promotion evidence.',
      results,
    };
  });
  report.nonLocalOrWriteRequests = requests;
  const downloadPromise = page.waitForEvent('download');
  await page.evaluate((value) => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'asr-browser-smoke.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, report);
  const download = await downloadPromise;
  await download.saveAs('output/research-evaluation/asr-browser-smoke.json');
  return {
    rows: report.results.length,
    failures: report.results.filter((row) => row.failed),
    nonLocalOrWriteRequests: requests,
  };
}
