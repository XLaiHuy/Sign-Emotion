async (page) => {
  let navigations = 0;
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations++;
  });

  await page.evaluate(() => sessionStorage.removeItem('__signemoRecoveryGumCalls'));
  await page.addInitScript(() => {
    const originalSet = Storage.prototype.setItem;
    const originalRemove = Storage.prototype.removeItem;
    const recordMarker = (action, value) => {
      const key = '__signemoAuditMarkerHistory';
      const history = JSON.parse(sessionStorage.getItem(key) ?? '[]');
      history.push({ action, value, time: Date.now() });
      originalSet.call(sessionStorage, key, JSON.stringify(history.slice(-30)));
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === 'signemo.audit.startup') recordMarker('set', value);
      return originalSet.call(this, key, value);
    };
    Storage.prototype.removeItem = function (key) {
      if (key === 'signemo.audit.startup') recordMarker('remove', null);
      return originalRemove.call(this, key);
    };
    const media = navigator.mediaDevices;
    if (!media) return;
    Object.defineProperty(media, 'getUserMedia', {
      configurable: true,
      value: (constraints) => {
        const key = '__signemoRecoveryGumCalls';
        const count = Number(sessionStorage.getItem(key) ?? '0') + 1;
        sessionStorage.setItem(key, String(count));
        if (window.__signemoSyntheticGetUserMedia)
          return window.__signemoSyntheticGetUserMedia(constraints);
        return Promise.reject(
          new DOMException('Unexpected automatic device open', 'NotAllowedError'),
        );
      },
    });
  });

  await page.reload();
  await page.getByRole('heading', { name: 'Ở đây, mình hiểu nhau.' }).waitFor();
  await page.evaluate(() => {
    window.__signemoSyntheticGetUserMedia = async (constraints) => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#30483c';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      const video = canvas.captureStream(5);
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const destination = audioContext.createMediaStreamDestination();
      gain.gain.value = 0.003;
      oscillator.connect(gain).connect(destination);
      oscillator.start();
      window.__signemoRecoveryResources = { audioContext, oscillator };
      return constraints.audio === false
        ? video
        : new MediaStream([...video.getVideoTracks(), ...destination.stream.getAudioTracks()]);
    };
  });

  await page.getByRole('checkbox', { name: /Tôi từ 18 tuổi/ }).check();
  const start = page.getByRole('button', { name: 'Bắt đầu hội thoại' });
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll('button')].find((button) =>
        button.textContent.includes('Bắt đầu hội thoại'),
      )?.disabled,
    null,
    { timeout: 180_000 },
  );
  await start.click();
  await page.getByRole('button', { name: 'Kết thúc hội thoại' }).waitFor({ timeout: 180_000 });
  const callsDuringSession = await page.evaluate(() =>
    Number(sessionStorage.getItem('__signemoRecoveryGumCalls') ?? '0'),
  );
  if (callsDuringSession !== 1)
    throw new Error(`Expected one user-started capture request, got ${callsDuringSession}`);
  const navigationsDuringSession = navigations;
  await page.waitForTimeout(1000);
  if (navigations !== navigationsDuringSession)
    throw new Error('Unexpected navigation/reload when the conversation started');
  const phaseBeforeReload = await page.evaluate(() => {
    const marker = sessionStorage.getItem('signemo.audit.startup');
    return marker ? JSON.parse(marker).phase : null;
  });
  if (phaseBeforeReload !== 'running')
    throw new Error(`Expected running recovery marker before reload, got ${phaseBeforeReload}`);
  await page.waitForTimeout(3000);
  const sessionBeforeReload = await page.evaluate(() => ({
    button: [...document.querySelectorAll('button')].find((node) =>
      node.textContent?.includes('hội thoại'),
    )?.textContent?.trim(),
    marker: sessionStorage.getItem('signemo.audit.startup'),
    message: [...document.querySelectorAll('[role="alert"]')].map((node) => node.textContent),
  }));
  await page.evaluate(() => {
    const remove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      if (key === 'signemo.audit.startup')
        sessionStorage.setItem('__signemoMarkerClearStack', new Error().stack ?? 'unknown');
      return remove.call(this, key);
    };
  });

  await page.reload();
  await page.getByRole('heading', { name: 'Ở đây, mình hiểu nhau.' }).waitFor();
  await page.waitForTimeout(1200);
  const recovery = await page.evaluate(() => ({
    calls: Number(sessionStorage.getItem('__signemoRecoveryGumCalls') ?? '0'),
    marker: sessionStorage.getItem('signemo.audit.startup'),
    markerHistory: sessionStorage.getItem('__signemoAuditMarkerHistory'),
    clearStack: sessionStorage.getItem('__signemoMarkerClearStack'),
    interrupted: document.body.innerText.includes('Phiên trước bị gián đoạn'),
    cameraIsOff: [...document.querySelectorAll('.video-label')].some((node) =>
      node.textContent?.includes('Camera đang tắt'),
    ),
    startButtonVisible: [...document.querySelectorAll('button')].some((button) =>
      button.textContent?.includes('Bắt đầu hội thoại'),
    ),
  }));
  if (
    recovery.calls !== 1 ||
    !recovery.cameraIsOff ||
    !recovery.startButtonVisible ||
    !recovery.interrupted
  )
    throw new Error(
      `Recovery reopened a device or did not return to idle: ${JSON.stringify({ sessionBeforeReload, recovery })}`,
    );

  console.log(
    JSON.stringify({
      check:
        'no spontaneous start navigation; interrupted session recovers without reopening devices',
      navigationsDuringSession,
      recovery,
    }),
  );
  await page.evaluate(() => {
    window.__signemoRecoveryResources?.oscillator.stop();
    void window.__signemoRecoveryResources?.audioContext.close();
  });
}
