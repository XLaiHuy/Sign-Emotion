async function researchOfflineCheck(page) {
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
  await page.evaluate(async () => {
    for (const registration of await navigator.serviceWorker.getRegistrations())
      await registration.unregister();
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await cdp.send('Network.setBypassServiceWorker', { bypass: false });
  await cdp.detach();
  await page.evaluate(async () => {
    const fixture = await (await fetch('/research/evaluation/manifest.json')).json();
    const item = fixture.samples[0];
    window.researchPcm = await (await fetch(item.url)).arrayBuffer();
    window.researchSeconds = item.seconds;
    const html = await (await fetch('/')).text();
    const source = await (await fetch(html.match(/src="([^"]+\.js)"/)[1])).text();
    window.researchWorker = source.match(/\/assets\/speech\.worker-[A-Za-z0-9_-]+\.js/)[0];
    window.researchDecode = async () => {
      const worker = new Worker(window.researchWorker, { type: 'module' });
      const send = (message, expected) =>
        new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Gipformer timeout')), 60000);
          worker.onmessage = ({ data }) => {
            if (data.type === expected || data.type === 'error') {
              clearTimeout(timer);
              if (data.type === 'error') reject(new Error('Gipformer failed'));
              else resolve(data);
            }
          };
          worker.onerror = (event) => {
            clearTimeout(timer);
            reject(new Error('Worker failed: ' + event.message));
          };
          worker.postMessage(message);
        });
      try {
        await send({ type: 'init', profile: 'gipformer-research' }, 'ready');
        return (
          await send(
            {
              type: 'transcribe',
              id: 'offline',
              startMs: 0,
              endMs: window.researchSeconds * 1000,
              samples: new Float32Array(window.researchPcm),
            },
            'result',
          )
        ).segment.text;
      } finally {
        worker.terminate();
      }
    };
    const cache = await caches.open('signemo-research-gipformer-v1');
    await cache.put('/research/gipformer/tokens.txt', new Response('corrupt-fixture'));
  });
  try {
    const online = await page.evaluate(() => window.researchDecode());
    const repaired = await page.evaluate(async () => {
      const cache = await caches.open('signemo-research-gipformer-v1');
      return (
        (await (await cache.match('/research/gipformer/tokens.txt')).arrayBuffer()).byteLength ===
        25847
      );
    });
    await page.context().setOffline(true);
    const offline = await page.evaluate(() => window.researchDecode());
    if (!repaired || online !== offline) throw new Error('Offline/repair parity failed');
    return {
      checksumRepair: repaired,
      offlineFreshWorker: true,
      sameOutput: true,
      scope: 'Explicit research cache only; no production or physical-device performance claim',
    };
  } finally {
    await page.context().setOffline(false);
  }
}
