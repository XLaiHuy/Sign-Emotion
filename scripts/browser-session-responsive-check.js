// prettier-ignore
async (page) => {
  const requests = [];
  const errors = [];
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }));
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('http://localhost:8080/');
  // Exercise the existing PWA update path; never erase settings or the vault.
  const html = await (await page.request.get('http://localhost:8080/', { headers: { 'Cache-Control': 'no-cache' } })).text();
  const serverScript = html.match(/src="([^"]+\.js)"/)?.[1];
  if (!serverScript) throw new Error('Server module path missing');
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.update());
  if ((await page.locator('script[type="module"]').getAttribute('src')) !== serverScript) {
    await page
      .getByRole('button', { name: 'Cập nhật và tải lại', exact: true })
      .click({ timeout: 30000 });
  }
  await page.waitForFunction((expected) => document.querySelector('script[type="module"]')?.getAttribute('src') === expected, serverScript);
  await page.locator('[data-build]').waitFor();
  const build = await page.locator('[data-build]').getAttribute('data-build');
  const go = async (name) => {
    const menu = page.getByRole('button', { name: 'Mở menu', exact: true });
    if (await menu.isVisible()) await menu.click();
    await page.locator('.sidebar').getByRole('button', { name, exact: true }).click();
  };
  const layouts = [];
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [844, 390],
    [768, 1024],
    [1024, 768],
    [1366, 768],
    [1920, 1080],
    [683, 384],
  ]) {
    await page.setViewportSize({ width, height });
    await go('Hội thoại');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    if (overflow) throw new Error(`Conversation horizontal overflow: ${width}x${height}`);
    await go('Luyện nhịp rung');
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
      throw new Error(`Practice horizontal overflow: ${width}x${height}`);
    await go('Cài đặt');
    if (await page.getByText('Gói dùng trên thiết bị', { exact: true }).count())
      throw new Error('Manual pack UI still visible');
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1))
      throw new Error(`Settings horizontal overflow: ${width}x${height}`);
    layouts.push({ width, height, overflow });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await go('Hội thoại');
  await page.screenshot({ path: 'output/playwright/session-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Mở menu', exact: true }).click();
  await page.keyboard.press('Escape');
  if (
    !(await page
      .getByRole('button', { name: 'Mở menu', exact: true })
      .evaluate((element) => element === document.activeElement))
  )
    throw new Error('Menu focus not restored');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.locator('.privacy-note').scrollIntoViewIfNeeded();
  const privacy = await page.locator('.privacy-note').boundingBox();
  if (!privacy || privacy.y < 0 || privacy.y + privacy.height > 769)
    throw new Error('Sidebar privacy card clipped');
  await page.screenshot({ path: 'output/playwright/session-desktop.png', fullPage: true });
  // Instrument actual Web Audio nodes, without recording sound or transcripts.
  await page.evaluate(() => {
    window.__qaTones = [];
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (...args) {
      const node = original.apply(this, args);
      const context = this;
      const start = node.start.bind(node);
      const stop = node.stop.bind(node);
      const entry = {};
      node.start = (time) => {
        entry.start = time;
        entry.state = context.state;
        window.__qaTones.push(entry);
        return start(time);
      };
      node.stop = (time) => {
        entry.stop = time;
        return stop(time);
      };
      return node;
    };
  });
  await go('Luyện nhịp rung');
  const soundOff = page.getByRole('button', { name: 'Âm báo tắt', exact: true });
  if (await soundOff.isVisible()) await soundOff.click();
  await page.getByRole('button', { name: 'Thử âm', exact: true }).click();
  await page.waitForTimeout(200);
  const patterns = [];
  for (const name of ['Vui', 'Buồn', 'Giận', 'Ngạc nhiên']) {
    await page.evaluate(() => {
      window.__qaTones = [];
    });
    await page
      .locator('.practice-card')
      .filter({ has: page.getByRole('heading', { name, exact: true }) })
      .getByRole('button', { name: 'Thử nhịp', exact: true })
      .click();
    await page.getByText('Đã phát âm thanh', { exact: true }).waitFor();
    const tones = await page.evaluate(() =>
      window.__qaTones.map((t) => ({
        duration: Math.round((t.stop - t.start) * 1000),
        state: t.state,
      })),
    );
    patterns.push({ name, tones });
  }
  const expected = [[240], [160, 160], [70, 70, 70], [80]];
  patterns.forEach((pattern, i) => {
    if (
      JSON.stringify(pattern.tones.map((tone) => tone.duration)) !== JSON.stringify(expected[i]) ||
      pattern.tones.some((tone) => tone.state !== 'running')
    )
      throw new Error(`Audio pattern failed: ${JSON.stringify(pattern)}`);
  });
  await go('Hội thoại');
  await page.getByRole('checkbox', { name: /Tôi từ 18 tuổi/ }).check();
  await page.waitForFunction(
    () => {
      const button = Array.from(document.querySelectorAll('button')).find((b) =>
        b.textContent.includes('Bắt đầu hội thoại'),
      );
      return button && !button.disabled;
    },
    undefined,
    { timeout: 180000 },
  );
  // Real workers + synthetic canvas/silent microphone, no physical-device claim.
  await page.evaluate(() => {
    window.__qaOriginalMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      window.__qaConstraints = constraints;
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
      window.__qaMedia = { stream, context, canvas };
      return stream;
    };
  });
  await page.getByRole('button', { name: 'Bắt đầu hội thoại', exact: true }).click();
  await page
    .getByRole('button', { name: 'Kết thúc hội thoại', exact: true })
    .waitFor({ timeout: 180000 });
  const capture = await page.evaluate(() => ({
    audio: Boolean(window.__qaConstraints.audio),
    video: Boolean(window.__qaConstraints.video),
    tracks: window.__qaMedia.stream.getTracks().map((t) => t.readyState),
  }));
  if (!capture.audio || !capture.video || capture.tracks.some((state) => state !== 'live'))
    throw new Error('Combined capture did not start');
  await page.getByRole('button', { name: 'Kết thúc hội thoại', exact: true }).click();
  await page.waitForFunction(() =>
    window.__qaMedia.stream.getTracks().every((t) => t.readyState === 'ended'),
  );
  await page.evaluate(async () => {
    await window.__qaMedia.context.close();
    navigator.mediaDevices.getUserMedia = window.__qaOriginalMedia;
  });
  if (errors.length) throw new Error('Page errors: ' + errors.join('; '));
  const foreign = requests.filter(
    (r) =>
      !r.url.startsWith('http://localhost:8080') &&
      !r.url.startsWith('blob:') &&
      !r.url.startsWith('data:'),
  );
  if (foreign.length || requests.some((r) => r.method === 'POST'))
    throw new Error('Unexpected upload/external request');
  return {
      build,
      layouts,
      patterns,
      syntheticCapture: capture,
      pageErrors: errors,
      uploads: 0,
  };
}
