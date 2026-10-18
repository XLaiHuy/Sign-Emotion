async (page) => {
  const target = new URL(page.url());
  if (!['127.0.0.1', 'localhost'].includes(target.hostname)) throw new Error('Local only');
  target.searchParams.set('moonshine', '1');
  await page.addInitScript(() => {
    const OriginalWorker = window.Worker;
    window.moonshineOfflineProbe = { ready: [], errors: 0, captureCalls: 0 };
    window.Worker = class extends OriginalWorker {
      constructor(...args) {
        super(...args);
        this.addEventListener('message', ({ data }) => {
          if (data.type === 'ready')
            window.moonshineOfflineProbe.ready.push({
              worker: new URL(args[0], location.href).pathname,
              modelVersion: data.modelVersion ?? null,
            });
          if (data.type === 'error') window.moonshineOfflineProbe.errors++;
        });
        this.addEventListener('error', () => window.moonshineOfflineProbe.errors++);
      }
    };
    if (navigator.mediaDevices)
      navigator.mediaDevices.getUserMedia = async () => {
        window.moonshineOfflineProbe.captureCalls++;
        throw new Error('Offline preparation must not open devices');
      };
  });
  const prepare = async () => {
    await page.getByRole('button', { name: 'Vào hội thoại', exact: true }).click();
    await page.getByRole('checkbox', { name: /Tôi từ 18 tuổi/ }).check();
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('button')].some(
          (button) => button.textContent.trim() === 'Bắt đầu hội thoại' && !button.disabled,
        ),
      null,
      { timeout: 240000 },
    );
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('label')].some(
          (label) =>
            label.textContent.includes('Thử gợi ý tổng hợp') &&
            label.querySelector('input')?.disabled === false,
        ),
      null,
      { timeout: 240000 },
    );
    return page.evaluate(() => ({
      ...window.moonshineOfflineProbe,
      isolated: crossOriginIsolated,
      controlled: Boolean(navigator.serviceWorker.controller),
    }));
  };
  await page.goto(target.href);
  const online = await prepare();
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await page.goto('about:blank');
  await page.context().setOffline(true);
  try {
    await page.goto(target.href);
    const offline = await prepare();
    if (
      !offline.isolated ||
      !offline.controlled ||
      offline.captureCalls ||
      offline.errors ||
      !offline.ready.some((item) => item.modelVersion?.startsWith('moonshine-streaming-tiny-vi@'))
    )
      throw new Error('Offline preparation failed');
    await page.screenshot({ path: 'output/playwright/moonshine-offline.png', fullPage: true });
    const report = {
      online,
      offline,
      scope:
        'Fresh offline core model warm-up and text assets available; text inference, physical devices and speech accuracy not exercised',
    };
    const download = page.waitForEvent('download');
    await page.evaluate((report) => {
      const link = document.createElement('a');
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
      );
      link.href = url;
      link.download = 'moonshine-offline.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, report);
    await (await download).saveAs('output/research-evaluation/moonshine-offline.json');
    return report;
  } finally {
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))).catch(() => {});
    await page.goto('about:blank');
    await page.context().setOffline(false);
  }
};
