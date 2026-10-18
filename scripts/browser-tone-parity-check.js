async function researchToneCheck(page) {
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
  await cdp.detach();
  const result = await page.evaluate(async () => {
    const root = '/research/tone-synthetic/';
    const manifest = await (await fetch(root + 'manifest.json')).json();
    const fixture = await (await fetch(root + 'parity.json')).json();
    const bytes = await (await fetch(root + 'tone.onnx')).arrayBuffer();
    const html = await (await fetch('/')).text();
    const entry = html.match(/src="([^"]+\.js)"/)[1];
    const source = await (await fetch(entry)).text();
    const workerUrl = source.match(/\/assets\/emotion\.worker-[A-Za-z0-9_-]+\.js/)[0];
    const worker = new Worker(workerUrl, { type: 'module' });
    const send = (message, expected) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Tone worker timeout')), 30000);
        worker.onmessage = ({ data }) => {
          if (data.type === expected || data.type === 'error') {
            clearTimeout(timer);
            if (data.type === 'error') reject(new Error('Tone worker failed'));
            else resolve(data);
          }
        };
        worker.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Tone worker failed'));
        };
        worker.postMessage(message);
      });
    try {
      const ready = await send(
        { type: 'init', text: false, research: true, prosody: { manifest, bytes } },
        'ready',
      );
      let maxError = 0;
      for (const [index, features] of fixture.features.entries()) {
        const prediction = await send(
          {
            type: 'infer',
            id: String(index),
            startMs: 0,
            endMs: 960,
            prosody: { version: manifest.featureVersion, features, frames: 30, durationMs: 960 },
            quality: { speechRms: 0.1, noiseRms: 0.001, noiseMeasured: true, clippingRatio: 0 },
          },
          'result',
        );
        const logits = fixture.expected[index],
          maximum = Math.max(...logits);
        const values = logits.map((value) => Math.exp(value - maximum));
        const total = values.reduce((sum, value) => sum + value, 0);
        const actual = prediction.evidence[0];
        if (actual.source !== 'voice' || actual.quality !== 'usable')
          throw new Error('Tone contract failed');
        values.forEach((value, i) => {
          maxError = Math.max(
            maxError,
            Math.abs(value / total - actual.scores[manifest.labels[i]]),
          );
        });
      }
      const rejected = await send(
        {
          type: 'infer',
          id: 'poor-audio',
          startMs: 0,
          endMs: 960,
          prosody: {
            version: manifest.featureVersion,
            features: fixture.features[0],
            frames: 30,
            durationMs: 960,
          },
          quality: { speechRms: 0.1, noiseRms: 0.1, noiseMeasured: false, clippingRatio: 0 },
        },
        'result',
      );
      if (maxError > 1e-5 || rejected.evidence[0].quality !== 'rejected')
        throw new Error('Tone parity/quality gate failed');
      return {
        samples: fixture.features.length,
        maxSoftmaxError: maxError,
        ready,
        poorAudioRejected: true,
        scope: 'Synthetic mechanics only; no Vietnamese tone quality evidence',
      };
    } finally {
      worker.terminate();
    }
  });
  return result;
}
