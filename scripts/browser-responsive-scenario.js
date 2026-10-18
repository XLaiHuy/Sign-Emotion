async (page) => {
  const report = { layouts: [], pageErrors: 0, syntheticRotation: null, passed: false };
  const errors = () => report.pageErrors++;
  page.on('pageerror', errors);
  await page.addInitScript(() => {
    window.__qaWorkers = 0;
    const NativeWorker = Worker;
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args);
        window.__qaWorkers++;
      }
    };
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      window.__qaCaptureCalls = (window.__qaCaptureCalls ?? 0) + 1;
      const stream = new MediaStream();
      if (constraints.video) {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const context = canvas.getContext('2d');
        const paint = () => {
          context.fillStyle = '#53675d';
          context.fillRect(0, 0, 640, 480);
        };
        paint();
        window.__qaPaint = setInterval(paint, 100);
        canvas
          .captureStream(5)
          .getVideoTracks()
          .forEach((t) => stream.addTrack(t));
      }
      if (constraints.audio) {
        const audio = new AudioContext(),
          oscillator = audio.createOscillator(),
          gain = audio.createGain(),
          destination = audio.createMediaStreamDestination();
        gain.gain.value = 0;
        oscillator.connect(gain).connect(destination);
        oscillator.start();
        destination.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
        window.__qaAudio = audio;
      }
      return stream;
    };
  });
  try {
    await page.reload();
    await page.getByRole('button', { name: 'Vào hội thoại', exact: true }).click();
    const viewports = [
      [360, 640],
      [390, 844],
      [844, 390],
      [800, 360],
      [768, 1024],
      [1024, 768],
      [1366, 768],
      [1920, 1080],
    ];
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      const row = await page.evaluate(() => {
        const box = (s) => {
          const r = document.querySelector(s).getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            bottom: r.bottom,
            right: r.right,
          };
        };
        const caption = box('.caption-panel'),
          camera = box('.conversation-video');
        const inside = (b) =>
          b.width > 0 &&
          b.height > 0 &&
          b.x >= 0 &&
          b.y >= 0 &&
          b.right <= innerWidth + 1 &&
          b.bottom <= innerHeight + 1;
        return {
          width: innerWidth,
          height: innerHeight,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          caption,
          camera,
          captionVisible: inside(caption),
          cameraVisible: inside(camera),
          dualPane: caption.x >= camera.right,
        };
      });
      row.passed =
        !row.overflow &&
        row.captionVisible &&
        row.cameraVisible &&
        (!(height <= 520 && width > height) || row.dualPane);
      report.layouts.push(row);
      await page.screenshot({ path: `output/playwright/responsive-${width}x${height}.png` });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('checkbox', { name: /Tôi từ 18 tuổi/ }).check();
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('button')].some(
          (b) => b.textContent.includes('Bắt đầu hội thoại') && !b.disabled,
        ),
      null,
      { timeout: 240000 },
    );
    await page.getByRole('button', { name: 'Bắt đầu hội thoại', exact: true }).click();
    await page
      .getByRole('button', { name: 'Kết thúc hội thoại', exact: true })
      .waitFor({ timeout: 60000 });
    await page.evaluate(() => {
      window.__qaVideo = document.querySelector('.conversation-video video');
      window.__qaStream = window.__qaVideo.srcObject;
      window.__qaWorkerCount = window.__qaWorkers;
      window.__qaInitialCalls = window.__qaCaptureCalls;
    });
    for (const [width, height] of [
      [844, 390],
      [390, 844],
      [800, 360],
    ])
      await page.setViewportSize({ width, height });
    report.syntheticRotation = await page.evaluate(() => ({
      sameVideo: window.__qaVideo === document.querySelector('.conversation-video video'),
      sameStream: window.__qaStream === window.__qaVideo.srcObject,
      tracksLive: window.__qaStream.getTracks().every((t) => t.readyState === 'live'),
      noWorkerRestart: window.__qaWorkers === window.__qaWorkerCount,
      noNewCapture: window.__qaCaptureCalls === window.__qaInitialCalls,
    }));
    await page.getByRole('button', { name: 'Kết thúc hội thoại', exact: true }).click();
    await page.evaluate(() => {
      clearInterval(window.__qaPaint);
      window.__qaAudio?.close();
    });
    report.passed =
      report.layouts.every((r) => r.passed) &&
      Object.values(report.syntheticRotation).every(Boolean) &&
      !report.pageErrors;
  } catch (error) {
    report.failure = String(error.message).slice(0, 300);
  } finally {
    page.off('pageerror', errors);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))).catch(() => {});
  }
  const download = page.waitForEvent('download');
  await page.evaluate((report) => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'responsive-report.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, report);
  await (await download).saveAs('output/playwright/responsive-report.json');
  return report;
};
