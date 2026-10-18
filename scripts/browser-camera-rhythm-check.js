async (page) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('http://localhost:8080/');
  await page.getByRole('button', { name: 'Cài đặt', exact: true }).click();
  await page.getByRole('combobox', { name: 'Chế độ nhịp phản hồi' }).selectOption('auto');
  await page.getByRole('checkbox', { name: 'Phát âm báo nhẹ khi thiết bị không hỗ trợ rung' }).check();
  await page.getByRole('button', { name: 'Camera biểu cảm riêng', exact: true }).click();
  // Deterministic face scores test UI/gate/audio integration, not AI accuracy.
  await page.evaluate(() => {
    window.__qaOriginalWorker = window.Worker;
    window.Worker = class {
      onmessage = null;
      onerror = null;
      stopped = false;
      postMessage(message) {
        if (message.type === 'init') queueMicrotask(() => this.onmessage?.({ data: { type: 'ready' } }));
        if (message.type === 'frame') {
          message.bitmap.close();
          if (!this.stopped) queueMicrotask(() => this.onmessage?.({ data: { type: 'result', result: {
            status: 'valid', scores: [0.01, 0.93, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01],
            label: null, score: 0, timestamp: message.timestamp, processingMs: 1, modelVersion: 'qa-synthetic',
          } } }));
        }
      }
      terminate() { this.stopped = true; }
    };
    window.__qaOriginalMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
      canvas.getContext('2d').fillRect(0,0,640,480);
      const stream = canvas.captureStream(5);
      window.__qaCamera = { stream, canvas };
      return stream;
    };
  });
  try {
    await page.getByRole('checkbox', { name: /Tôi từ 18 tuổi/ }).check();
    await page.getByRole('button', { name: 'Bắt đầu camera', exact: true }).click();
    await page.getByText('Đã phát âm thanh', { exact: true }).waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'Kết thúc phiên', exact: true }).click();
    const ended = await page.evaluate(() => window.__qaCamera.stream.getTracks().every((track) => track.readyState === 'ended'));
    if (!ended) throw new Error('Camera rhythm test leaked tracks');
    return { syntheticFaceScores: true, audioOutput: true, cameraStopped: ended };
  } finally {
    await page.evaluate(() => { window.Worker = window.__qaOriginalWorker; navigator.mediaDevices.getUserMedia = window.__qaOriginalMedia; window.__qaCamera?.stream.getTracks().forEach((t) => t.stop()); });
  }
}
