// prettier-ignore
async (page) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('http://localhost:8080/');
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
  await page
    .getByText('Ứng dụng và tất cả model đã sẵn sàng khi mất mạng.', { exact: true })
    .waitFor({ timeout: 180000 });
  const state = await page.evaluate(async () => ({
    controlled: Boolean(navigator.serviceWorker.controller),
    faceAssets: (await (await caches.open('signemo-models-v1')).keys()).length,
    conversationAssets: (await (await caches.open('signemo-conversation-v1')).keys()).length,
  }));
  if (!state.controlled || state.faceAssets < 14 || state.conversationAssets < 26)
    throw new Error('Incomplete auto cache: ' + JSON.stringify(state));
  await page.context().setOffline(true);
  let reopened;
  try {
    reopened = await page.context().newPage();
    await reopened.bringToFront();
    await reopened.goto('http://localhost:8080/');
    await reopened.getByRole('heading', { name: 'Ở đây, mình hiểu nhau.', exact: true }).waitFor();
    const workers = await reopened.evaluate(async () => {
      const main = document.querySelector('script[type="module"]').getAttribute('src');
      const source = await (await fetch(main)).text();
      const results = [];
      for (const name of ['face', 'speech', 'vad']) {
        const path = source.match(new RegExp(`/assets/${name}\\.worker-[A-Za-z0-9_-]+\\.js`))?.[0];
        if (!path) throw new Error('Worker path missing: ' + name);
        const result = await new Promise((resolve, reject) => {
          const worker = new Worker(path, { type: 'module' });
          let stage = 'initializing';
          const finish = (error, value) => {
            clearTimeout(timer);
            worker.terminate();
            error ? reject(error) : resolve(value);
          };
          const timer = setTimeout(() => finish(new Error('Offline timeout: ' + name + ' · ' + stage)), 90000);
          worker.onerror = (e) => finish(new Error(e.message));
          worker.onmessage = async (e) => {
            if (e.data.type === 'error') finish(new Error(e.data.message));
            if (e.data.type === 'ready') {
              stage = 'ready';
              if (name !== 'face') return finish(null, { name, ready: true });
              const canvas = new OffscreenCanvas(640, 480);
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = '#888'; ctx.fillRect(0, 0, 640, 480);
              const bitmap = await createImageBitmap(canvas);
              worker.postMessage({ type: 'frame', timestamp: performance.now(), bitmap }, [bitmap]);
            }
            if (e.data.type === 'result') finish(null, { name, status: e.data.result.status });
          };
          worker.postMessage({ type: 'init', base: false });
        });
        results.push(result);
      }
      return results;
    });
    if (workers[0].status !== 'no-face') throw new Error('Offline face inference failed');
    return { state, offlineReopen: true, workers };
  } finally {
    await reopened?.close();
    await page.context().setOffline(false);
  }
}
