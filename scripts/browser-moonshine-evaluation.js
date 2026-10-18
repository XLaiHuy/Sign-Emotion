async (page) => {
  const target = new URL(page.url());
  if (!['127.0.0.1', 'localhost'].includes(target.hostname))
    throw new Error('Local evaluation only');
  await page.goto('about:blank');
  const context = await page.context().browser().newContext({ serviceWorkers: 'block' });
  page = await context.newPage();
  try {
    const requests = { external: 0, nonGet: 0 };
    page.on('request', (request) => {
      if (new URL(request.url()).origin !== target.origin) requests.external++;
      if (request.method() !== 'GET') requests.nonGet++;
    });
    // Keep this comparison separate from UI/face load. Actual pinned ASR worker, public audio only.
    const assetResponse = await page.request.get(target.origin + '/');
    const html = await assetResponse.text();
    const entry = html.match(/src="([^\"]*\/assets\/index-[^\"]+\.js)"/)?.[1];
    if (!entry) throw new Error('Missing entry');
    const bundle = await (await page.request.get(target.origin + entry)).text();
    const worker = bundle.match(/\/assets\/speech-moonshine\.worker-[\w-]+\.js/)?.[0];
    if (!worker) throw new Error('Missing streaming worker');
    await page.route('**/assets/index-*.js', (route) =>
      route.fulfill({ body: '', contentType: 'application/javascript' }),
    );
    await page.goto(target.href);
    const result = await page.evaluate(
      async ({ workerUrl }) => {
        const manifest = await (await fetch('/research/evaluation/manifest.json')).json();
        const asr = new Worker(workerUrl, { type: 'module' });
        let serial = 0;
        const task = (message) =>
          new Promise((resolve, reject) => {
            const timer = setTimeout(
              () => finish(null, true),
              message.type === 'dispose' ? 5000 : 120000,
            );
            const finish = (data, failed = false) => {
              clearTimeout(timer);
              asr.removeEventListener('message', receive);
              asr.removeEventListener('error', error);
              if (failed) reject(new Error('Local ASR evaluation failed'));
              else resolve(data);
            };
            const error = () => finish(null, true);
            const receive = (event) => {
              if (event.data.type === 'error') finish(null, true);
              else if (
                (message.type === 'dispose' && event.data.type === 'disposed') ||
                (message.type === 'init' && event.data.type === 'ready') ||
                (message.id && event.data.segment?.id === message.id)
              )
                finish(event.data);
            };
            asr.addEventListener('message', receive);
            asr.addEventListener('error', error);
            asr.postMessage(message);
          });
        const words = (text) =>
          text
            .normalize('NFC')
            .toLocaleLowerCase('vi')
            .match(/[\p{L}\p{N}]+/gu) ?? [];
        const distance = (a, b) => {
          let row = Array.from({ length: b.length + 1 }, (_, i) => i);
          for (let i = 1; i <= a.length; i++) {
            const next = [i];
            for (let j = 1; j <= b.length; j++)
              next[j] = Math.min(
                next[j - 1] + 1,
                row[j] + 1,
                row[j - 1] + Number(a[i - 1] !== b[j - 1]),
              );
            row = next;
          }
          return row[b.length];
        };
        const rows = [];
        try {
          const prepare = performance.now();
          await task({ type: 'init', profile: 'moonshine-streaming-vi-research' });
          const prepareMs = performance.now() - prepare;
          for (const sample of manifest.samples) {
            const buffer = await (await fetch(sample.url)).arrayBuffer();
            const pcm = new Float32Array(buffer);
            const id = `evaluation-${serial++}`;
            let firstTextAudioMs = null,
              totalMs = 0,
              text = '',
              calls = 0;
            for (let end = 8192; end < pcm.length; end += 8192) {
              const response = await task({
                type: 'interim',
                id,
                revision: ++calls,
                samples: pcm.slice(0, end),
                startMs: 0,
                endMs: end / 16,
              });
              totalMs += response.segment.processingMs;
              if (firstTextAudioMs === null && response.segment.text.trim())
                firstTextAudioMs = end / 16;
            }
            const response = await task({
              type: 'transcribe',
              id,
              samples: pcm,
              startMs: 0,
              endMs: pcm.length / 16,
            });
            totalMs += response.segment.processingMs;
            text = response.segment.text;
            const ref = words(sample.reference),
              hyp = words(text);
            rows.push({
              id: sample.id,
              audioMs: pcm.length / 16,
              partialCalls: calls,
              firstTextAudioMs,
              totalProcessingMs: totalMs,
              effectiveRtf: totalMs / (pcm.length / 16),
              words: ref.length,
              wordErrors: distance(ref, hyp),
              chars: ref.join(' ').length,
              charErrors: distance([...ref.join(' ')], [...hyp.join(' ')]),
              modelVersion: response.segment.modelVersion,
            });
          }
          return {
            prepareMs,
            rows,
            workerTerminated: true,
            isolated: crossOriginIsolated,
            scope:
              'Five public FLEURS files, cumulative 512 ms requests, no VAD, no realtime pacing, no face/text load. First-text audio length is not live caption latency. No private audio or transcript in report.',
          };
        } finally {
          try {
            await task({ type: 'dispose' });
          } finally {
            asr.terminate();
          }
        }
      },
      { workerUrl: worker },
    );
    const sum = (key) => result.rows.reduce((n, row) => n + row[key], 0);
    const cdp = await context.newCDPSession(page);
    await page.waitForTimeout(6000);
    const targets = await cdp.send('Target.getTargets');
    result.workerTargetsAfterDispose = targets.targetInfos
      .filter(
        (info) =>
          ['worker', 'shared_worker'].includes(info.type) &&
          info.url.startsWith(target.origin + '/'),
      )
      .map((info) => ({ url: new URL(info.url).pathname, attached: info.attached }));
    await cdp.detach();
    const report = {
      ...result,
      requests,
      wer: sum('wordErrors') / sum('words'),
      cer: sum('charErrors') / sum('chars'),
      effectiveRtf: sum('totalProcessingMs') / sum('audioMs'),
    };
    const download = page.waitForEvent('download');
    await page.evaluate((report) => {
      const link = document.createElement('a');
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
      );
      link.href = url;
      link.download = 'moonshine-public-evaluation.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, report);
    await (await download).saveAs('output/research-evaluation/moonshine-public-evaluation.json');
    return {
      samples: result.rows.length,
      wer: report.wer,
      cer: report.cer,
      rtf: report.effectiveRtf,
      requests,
    };
  } finally {
    await context.close();
  }
};
