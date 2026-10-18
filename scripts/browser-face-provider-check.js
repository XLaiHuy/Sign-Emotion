async (page) => {
  const target = new URL(page.url());
  if (!['localhost', '127.0.0.1'].includes(target.hostname)) throw new Error('Local only');
  const context = await page.context().browser().newContext({ serviceWorkers: 'block' });
  const probe = await context.newPage();
  await page.goto('about:blank');
  try {
    const html = await (await probe.request.get(target.origin + '/')).text();
    const entry = html.match(/src="([^"]*\/assets\/index-[^"]+\.js)"/)[1];
    const source = await (await probe.request.get(target.origin + entry)).text();
    const worker = source.match(/\/assets\/face-gpu\.worker-[\w-]+\.js/)[0];
    await probe.route('**/assets/index-*.js', (route) =>
      route.fulfill({ body: '', contentType: 'application/javascript' }),
    );
    await probe.goto(target.href);
    return await probe.evaluate(
      async ({ workerUrl, delegate }) => {
        const worker = new Worker(workerUrl, { type: 'module' });
        const request = (message, transfer = []) =>
          new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Face provider timeout')), 120000);
            worker.onmessage = ({ data }) => {
              clearTimeout(timer);
              data.type === 'error' ? reject(new Error('Face provider failed')) : resolve(data);
            };
            worker.onerror = () => {
              clearTimeout(timer);
              reject(new Error('Face worker failed'));
            };
            worker.postMessage(message, transfer);
          });
        try {
          const ready = await request({
            type: 'init',
            research: true,
            faceProfile: 'b0-webgpu-research',
            detectorDelegate: delegate,
          });
          const image = await createImageBitmap(
            await (await fetch('/research/benchmark/astronaut.png')).blob(),
          );
          const canvas = new OffscreenCanvas(640, 480),
            ctx = canvas.getContext('2d');
          const statuses = [];
          for (const count of [1, 2, 0, 1]) {
            ctx.fillStyle = '#808080';
            ctx.fillRect(0, 0, 640, 480);
            if (count === 1) ctx.drawImage(image, 100, 20, 300, 330, 90, 0, 440, 480);
            if (count === 2)
              for (const x of [0, 320]) ctx.drawImage(image, 100, 20, 300, 330, x, 0, 300, 440);
            const bitmap = await createImageBitmap(canvas);
            const answer = await request(
              {
                type: 'frame',
                requestId: statuses.length + 1,
                timestamp: performance.now(),
                bitmap,
              },
              [bitmap],
            );
            statuses.push(answer.result.status);
          }
          image.close();
          if (
            statuses[1] !== 'multiple-faces' ||
            statuses[2] !== 'no-face' ||
            statuses[0] !== 'valid' ||
            statuses[3] !== 'valid'
          )
            throw new Error('Face-count regression');
          return {
            detectorDelegate: ready.detectorDelegate,
            classifierBackend: ready.classifierBackend,
            statuses,
            scope:
              'Public NASA canvas count/lifecycle mechanics; no emotion accuracy or latency claim',
          };
        } finally {
          worker.postMessage({ type: 'dispose' });
          worker.terminate();
        }
      },
      {
        workerUrl: worker,
        delegate: target.searchParams.get('detector') === 'gpu' ? 'GPU' : 'CPU',
      },
    );
  } finally {
    await context.close();
  }
};
