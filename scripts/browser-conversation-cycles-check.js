async function conversationCycles(page) {
  const intro = page.getByRole('button', { name: 'Vào hội thoại', exact: true });
  if (await intro.isVisible()) await intro.click();
  const build = await page.locator('[data-build]').getAttribute('data-build');
  const navigations = [];
  const navigationListener = (frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  };
  page.on('framenavigated', navigationListener);
  await page.getByRole('checkbox', { name: /Tôi từ 18 tuổi/ }).check();
  await page.evaluate(() => {
    window.cycleQa = { calls: 0, streams: [], contexts: [], workers: 0, maximumWorkers: 0 };
    const originalWorker = window.Worker;
    window.Worker = class extends originalWorker {
      stopped = false;
      constructor(...args) {
        super(...args);
        window.cycleQa.workers++;
        window.cycleQa.maximumWorkers = Math.max(
          window.cycleQa.maximumWorkers,
          window.cycleQa.workers,
        );
      }
      terminate() {
        if (!this.stopped) {
          this.stopped = true;
          window.cycleQa.workers--;
        }
        super.terminate();
      }
    };
    window.cycleQa.originalWorker = originalWorker;
    window.cycleQa.originalMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (!constraints.audio || !constraints.video)
        throw new Error('Combined media request required');
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      canvas.getContext('2d').fillRect(0, 0, 640, 480);
      const context = new AudioContext();
      await context.resume();
      const destination = context.createMediaStreamDestination();
      const stream = new MediaStream([
        ...canvas.captureStream(5).getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);
      window.cycleQa.calls++;
      window.cycleQa.streams.push(stream);
      window.cycleQa.contexts.push(context);
      return stream;
    };
  });
  try {
    for (let index = 0; index < 10; index++) {
      const start = page.getByRole('button', { name: 'Bắt đầu hội thoại', exact: true });
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('button')].some(
            (b) => b.textContent.includes('Bắt đầu hội thoại') && !b.disabled,
          ),
        undefined,
        { timeout: 180000 },
      );
      await start.click();
      const stop = page.getByRole('button', { name: 'Kết thúc hội thoại', exact: true });
      await stop.waitFor({ timeout: 180000 });
      await stop.click();
      await page.waitForFunction(() =>
        window.cycleQa.streams.every((stream) =>
          stream.getTracks().every((track) => track.readyState === 'ended'),
        ),
      );
      await page.evaluate(async () => {
        for (const context of window.cycleQa.contexts)
          if (context.state !== 'closed') await context.close();
      });
    }
    const result = await page.evaluate(() => ({
      calls: window.cycleQa.calls,
      stoppedStreams: window.cycleQa.streams.filter((stream) =>
        stream.getTracks().every((track) => track.readyState === 'ended'),
      ).length,
      maximumWorkers: window.cycleQa.maximumWorkers,
    }));
    if (
      result.calls !== 10 ||
      result.stoppedStreams !== 10 ||
      result.maximumWorkers > 4 ||
      navigations.length
    )
      throw new Error('Cycle lifecycle regression');
    return {
      ...result,
      build,
      unexpectedNavigations: navigations.length,
      scope:
        'Real model workers, synthetic silent media; not physical PC microphone/camera acceptance',
    };
  } finally {
    page.off('framenavigated', navigationListener);
    await page.evaluate(async () => {
      navigator.mediaDevices.getUserMedia = window.cycleQa.originalMedia;
      window.Worker = window.cycleQa.originalWorker;
      for (const stream of window.cycleQa.streams)
        stream.getTracks().forEach((track) => track.stop());
      for (const context of window.cycleQa.contexts)
        if (context.state !== 'closed') await context.close();
    });
  }
}
