async (page) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('http://localhost:8080/');
  await page.context().grantPermissions(['camera', 'microphone'], { origin: 'http://localhost:8080' });
  await page.evaluate(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.__deviceCapture = { requested: false };
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      window.__deviceCapture.requested = true;
      try {
        const stream = await original(constraints);
        window.__deviceCapture.stream = stream;
        window.__deviceCapture.synthetic = stream.getTracks().some((t) => /fake|dummy/i.test(t.label));
        return stream;
      } catch (error) {
        window.__deviceCapture.error = error.name;
        throw error;
      }
    };
  });
  await page.getByRole('checkbox', { name: /Tôi từ 18 tuổi/ }).check();
  await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some((b) => b.textContent.includes('Bắt đầu hội thoại') && !b.disabled), undefined, { timeout: 60000 });
  await page.getByRole('button', { name: 'Bắt đầu hội thoại', exact: true }).click();
  try {
    await Promise.race([
      page.getByRole('button', { name: 'Kết thúc hội thoại', exact: true }).waitFor({ timeout: 30000 }),
      page.getByRole('alert').waitFor({ timeout: 30000 }),
    ]);
    const started = await page.getByRole('button', { name: 'Kết thúc hội thoại', exact: true }).isVisible();
    if (started) await page.getByRole('button', { name: 'Kết thúc hội thoại', exact: true }).click();
    return await page.evaluate((started) => ({
      requested: window.__deviceCapture.requested,
      captureStarted: started,
      syntheticDevice: window.__deviceCapture.synthetic ?? null,
      error: window.__deviceCapture.error ?? null,
      allTracksEnded: window.__deviceCapture.stream?.getTracks().every((t) => t.readyState === 'ended') ?? null,
    }), started);
  } finally {
    const cancel = page.getByRole('button', { name: 'Hủy', exact: true });
    if (await cancel.isVisible()) await cancel.click();
    await page.evaluate(() => window.__deviceCapture.stream?.getTracks().forEach((t) => t.stop()));
  }
}
