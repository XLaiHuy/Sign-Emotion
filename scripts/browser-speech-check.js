async (page) => {
  const samples = __SAMPLES__;
  const results = [];
  const requests = [];
  page.on('request', request => {
    if (request.method() !== 'GET' || !new URL(request.url()).hostname.match(/^(localhost|127\.0\.0\.1)$/))
      requests.push({ method: request.method(), url: request.url() });
  });
  for (const sample of samples) {
    await page.getByLabel('Chọn WAV/MP3/WebM').setInputFiles(sample.path);
    await page.getByLabel('Văn bản tham chiếu').fill(sample.reference);
    await page.getByRole('button', { name: 'Chạy kiểm thử tiếng Việt', exact: true }).click();
    await page.getByRole('button', { name: 'Chạy kiểm thử tiếng Việt', exact: true }).waitFor({ state: 'visible', timeout: 180000 });
    const failure = page.locator('.settings-card .error-box');
    if (await failure.count()) throw new Error(await failure.innerText());
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Xuất kết quả JSON', exact: true }).click(),
    ]);
    await download.saveAs(`output/evaluation/result-${sample.row}.json`);
    results.push({ row: sample.row, displayed: await page.locator('.speech-lab-result').innerText() });
  }
  await page.screenshot({ path: 'output/playwright/speech-lab.png', fullPage: true });
  return { results, nonLocalOrWriteRequests: requests };
}
