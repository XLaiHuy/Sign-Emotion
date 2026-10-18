async (page) => {
  const result = await page.evaluate(async () => {
    const main = document.querySelector('script[type="module"]').getAttribute('src');
    const source = await (await fetch(main)).text();
    const workerPath = source.match(/\/assets\/face\.worker-[A-Za-z0-9_-]+\.js/)[0];
    return new Promise((resolve, reject) => {
      const worker = new Worker(workerPath, { type: 'module' });
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('Worker timeout'));
      }, 55000);
      worker.onerror = (e) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(new Error(e.message));
      };
      worker.onmessage = async (e) => {
        if (e.data.type === 'error') {
          clearTimeout(timeout);
          worker.terminate();
          reject(new Error(e.data.message));
        }
        if (e.data.type === 'ready') {
          const canvas = new OffscreenCanvas(640, 480);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#888';
          ctx.fillRect(0, 0, 640, 480);
          const bitmap = await createImageBitmap(canvas);
          worker.postMessage({ type: 'frame', timestamp: performance.now(), bitmap }, [bitmap]);
        }
        if (e.data.type === 'result') {
          clearTimeout(timeout);
          worker.terminate();
          resolve(e.data.result);
        }
      };
      worker.postMessage({ type: 'init' });
    });
  });
  if (result.status !== 'no-face') throw new Error('Blank frame should have no face');
  console.log(
    JSON.stringify({
      check: 'actual MediaPipe + EmotiEffLib worker initialization and blank-frame rejection',
      result,
    }),
  );
};
