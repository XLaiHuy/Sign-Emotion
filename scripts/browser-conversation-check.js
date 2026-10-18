async (page) => {
  const uploads = [];
  const external = [];
  page.on('request', (request) => {
    if (request.method() === 'POST') uploads.push(request.url());
    if (!request.url().startsWith(new URL(page.url()).origin)) external.push(request.url());
  });

  await page.getByRole('heading', { name: 'Ở đây, mình hiểu nhau.' }).waitFor();
  await page.evaluate(() => {
    const calls = [];
    const applicationAudioContexts = [];
    const NativeAudioContext = window.AudioContext;
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: class extends NativeAudioContext {
        constructor(...args) {
          super(...args);
          applicationAudioContexts.push(this);
        }
      },
    });
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext('2d');
    let frame = 0;
    const paint = () => {
      if (!context) return;
      context.fillStyle = frame++ % 2 ? '#263b32' : '#30483c';
      context.fillRect(0, 0, canvas.width, canvas.height);
      requestAnimationFrame(paint);
    };
    paint();

    const videoStream = () => canvas.captureStream(8);
    const audioContext = new NativeAudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const destination = audioContext.createMediaStreamDestination();
    oscillator.frequency.value = 180;
    gain.gain.value = 0.005;
    oscillator.connect(gain).connect(destination);
    oscillator.start();
    const audioTrack = destination.stream.getAudioTracks()[0];
    const media = navigator.mediaDevices;
    Object.defineProperty(media, 'enumerateDevices', {
      configurable: true,
      value: async () => [
        { kind: 'videoinput', deviceId: 'qa-cam-1', label: 'QA camera 1' },
        { kind: 'videoinput', deviceId: 'qa-cam-2', label: 'QA camera 2' },
      ],
    });
    Object.defineProperty(media, 'getUserMedia', {
      configurable: true,
      value: async (constraints) => {
        calls.push(constraints);
        const video = videoStream();
        const stream =
          constraints.audio === false
            ? video
            : new MediaStream([...video.getVideoTracks(), audioTrack]);
        window.__signemoQa = {
          calls,
          streams: [...(window.__signemoQa?.streams ?? []), stream],
          audioTrack,
          audioContext,
          applicationAudioContexts,
          oscillator,
        };
        return stream;
      },
    });
  });

  await page.getByRole('checkbox', { name: /Tôi từ 18 tuổi/ }).check();
  const start = page.getByRole('button', { name: 'Bắt đầu hội thoại' });
  await start.waitFor({ state: 'visible' });
  await start.waitFor({ state: 'attached' });
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll('button')].find((button) =>
        button.textContent.includes('Bắt đầu hội thoại'),
      )?.disabled,
    null,
    { timeout: 180_000 },
  );
  await start.click();
  const end = page.getByRole('button', { name: 'Kết thúc hội thoại' });
  await end.waitFor({ timeout: 180_000 });

  const cameraSwitch = page.getByRole('button', { name: 'Đổi camera trước hoặc sau' });
  await cameraSwitch.click();
  await page.waitForFunction(() => !document.querySelector('.video-switch')?.disabled);
  const afterSwitch = await page.evaluate(() => ({
    getUserMediaCalls: window.__signemoQa.calls.length,
    initialRequestedAudio: typeof window.__signemoQa.calls[0].audio === 'object',
    initialRequestedVideo: typeof window.__signemoQa.calls[0].video === 'object',
    switchRequestedNoAudio: window.__signemoQa.calls[1]?.audio === false,
    microphoneStillLive: window.__signemoQa.audioTrack.readyState === 'live',
  }));
  if (!afterSwitch.initialRequestedAudio || !afterSwitch.initialRequestedVideo)
    throw new Error(
      `Session did not request camera and microphone together: ${JSON.stringify(afterSwitch)}`,
    );
  if (!afterSwitch.switchRequestedNoAudio || !afterSwitch.microphoneStillLive)
    throw new Error(`Camera switch interrupted the microphone: ${JSON.stringify(afterSwitch)}`);

  await end.click();
  await page.getByText('Đã kết thúc phiên.', { exact: false }).waitFor({ timeout: 20_000 });
  const stopped = await page.evaluate(() => ({
    tracksStopped: window.__signemoQa.streams
      .flatMap((stream) => stream.getTracks())
      .every((track) => track.readyState === 'ended'),
    appAudioContextClosed: window.__signemoQa.applicationAudioContexts.some(
      (context) => context.state === 'closed',
    ),
  }));
  if (!stopped.tracksStopped || !stopped.appAudioContextClosed)
    throw new Error(`Session resources survived stop: ${JSON.stringify(stopped)}`);
  if (uploads.length)
    throw new Error(`Unexpected upload during local session: ${uploads.join(',')}`);
  if (external.length)
    throw new Error(`Unexpected external resource request: ${external.join(',')}`);
  console.log(
    JSON.stringify({
      check: 'synthetic camera+microphone start, switch, teardown',
      afterSwitch,
      stopped,
      uploads: uploads.length,
      external: external.length,
    }),
  );
  await page.evaluate(() => {
    window.__signemoQa.oscillator.stop();
    void window.__signemoQa.audioContext.close();
  });
}
