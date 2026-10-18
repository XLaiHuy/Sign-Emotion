async (page) => {
  // Run with playwright-cli run-code --filename=... after opening the local build.
  // Short smoke: ?benchmark=1&durationSeconds=120 ; endurance: 1800 (default).
  // This is a synthetic LOAD test, never face accuracy or synchronized fusion quality.
  const target = new URL(page.url());
  if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname))
    throw new Error('Local benchmark only');
  target.searchParams.set('benchmark', '1');
  const seconds = Number(target.searchParams.get('durationSeconds') ?? 1800);
  if (!Number.isFinite(seconds) || seconds < 30 || seconds > 1800)
    throw new Error('Invalid duration');
  const network = { nonGet: 0, external: 0, unusedWhisperAssets: 0 },
    pageErrors = { count: 0 };
  const onRequest = (request) => {
    if (request.method() !== 'GET') network.nonGet++;
    if (new URL(request.url()).origin !== target.origin) network.external++;
    if (/\/models\/local\/.*(?:phowhisper|whisper)/i.test(new URL(request.url()).pathname))
      network.unusedWhisperAssets++;
  };
  const onError = () => {
    pageErrors.count++;
  };
  page.on('request', onRequest);
  page.on('pageerror', onError);
  let report;
  let afterFinish = null;
  const cdp = await page.context().newCDPSession(page);
  let commandLine = null;
  try {
    commandLine = await cdp.send('Browser.getBrowserCommandLine');
  } catch {
    /* Chrome without automation mode returns protocol error */
  }
  if (
    commandLine?.arguments &&
    !commandLine.arguments.some((arg) => arg.startsWith('--use-file-for-fake-audio-capture='))
  )
    throw new Error('This load test requires an owned Chrome fake microphone launch');
  // Dedicated CLI profile only: prevent a previous matrix image's SW serving stale JS.
  await cdp.send('Storage.clearDataForOrigin', { origin: target.origin, storageTypes: 'all' });
  const sampleMemory = async () => {
    const [dom, heap] = await Promise.all([
      cdp.send('Memory.getDOMCounters'),
      cdp.send('Runtime.getHeapUsage'),
    ]);
    return page.evaluate(
      ({ dom, heap }) => {
        const sample = {
          ...pipelineBench.snapshot(),
          domNodes: dom.nodes,
          documents: dom.documents,
          eventListeners: dom.jsEventListeners,
          cdpHeapUsedBytes: heap.usedSize,
          cdpHeapTotalBytes: heap.totalSize,
          // Main renderer only: never present as all worker/WASM/VRAM memory.
          cdpBackingStorageBytes: heap.backingStorageSize ?? null,
        };
        pipelineBench.samples.push(sample);
        return sample;
      },
      { dom, heap },
    );
  };
  try {
    await page.addInitScript(() => {
      const originalWorker = window.Worker;
      const originalCapture = navigator.mediaDevices.getUserMedia;
      const originalWorkletNode = window.AudioWorkletNode;
      const originalAudioContext = window.AudioContext;
      const state = (window.pipelineBench = {
        liveWorkers: 0,
        peakWorkers: 0,
        workerErrors: 0,
        classifierBackend: null,
        detectorDelegate: null,
        asrExecutionProfile: null,
        toneMeasurements: { count: 0, totalMs: 0, maxMs: 0 },
        captureCalls: 0,
        activeTracks: [],
        samples: [],
        stages: {},
        faceTimes: [],
        sourceFrameTimes: [],
        queueSamples: [],
        asrJobs: [],
        sourceVideo: null,
        sourceFrameCallback: null,
        wakeLock: null,
        speechSpans: [],
        asrDeliverySpan: null,
        partialSpanStart: null,
        clockAnchors: [],
        clockEpoch: 0,
        fixtureCaptionLatencies: { partial: [], final: [] },
        contexts: [],
        allContexts: [],
        timers: [],
        sources: [],
        startedAt: 0,
        audioStartedAt: 0,
        stopped: false,
        clockProbe: {
          frames: 0,
          lastOriginShiftMs: 0,
          maxAbsOriginShiftMs: 0,
          maxRolling120sDriftMs: 0,
          maxAbsRawMediaOriginShiftMs: 0,
          maxAbsOutputPairSkewMs: 0,
          maxContextFrameGapMs: 0,
          lastOutputPairSkewMs: 0,
        },
      });
      window.AudioContext = class extends originalAudioContext {
        constructor(...args) {
          super(...args);
          state.allContexts.push(this);
        }
      };
      window.AudioWorkletNode = class extends originalWorkletNode {
        constructor(context, name, options) {
          super(context, name, options);
          if (name !== 'signemo-capture') return;
          let firstOrigin;
          let firstRawOrigin;
          let previousEndSeconds;
          let epoch = state.clockEpoch;
          this.port.addEventListener('message', ({ data }) => {
            if (
              !Number.isFinite(data.contextEndSeconds) ||
              typeof context.getOutputTimestamp !== 'function'
            )
              return;
            const stamp = context.getOutputTimestamp();
            if (!(stamp.performanceTime > 0)) return;
            if (epoch !== state.clockEpoch) {
              firstOrigin = firstRawOrigin = previousEndSeconds = undefined;
              epoch = state.clockEpoch;
            }
            const samples = data.samples;
            if (samples?.length) {
              const rms = Math.sqrt(
                samples.reduce((sum, value) => sum + value * value, 0) / samples.length,
              );
              if (rms >= 0.003) {
                const endAt =
                  stamp.performanceTime + (data.contextEndSeconds - stamp.contextTime) * 1000;
                const startAt = endAt - samples.length / 16;
                let span = state.speechSpans.at(-1);
                if (!span || startAt - span.endAt > 1000) {
                  span = { startAt, endAt };
                  state.speechSpans.push(span);
                  if (state.speechSpans.length > 500) state.speechSpans.shift();
                } else span.endAt = endAt;
              }
            }
            const observedAt = performance.now();
            const origin = observedAt - data.contextEndSeconds * 1000;
            firstOrigin ??= origin;
            const drift = origin - firstOrigin;
            let anchor = state.clockAnchors.at(-1);
            if (!anchor || observedAt - anchor.at >= 1000) {
              anchor = { at: observedAt, min: origin, max: origin };
              state.clockAnchors.push(anchor);
            } else {
              anchor.min = Math.min(anchor.min, origin);
              anchor.max = Math.max(anchor.max, origin);
            }
            while (state.clockAnchors.length > 1 && observedAt - state.clockAnchors[0].at > 120000)
              state.clockAnchors.shift();
            let low = origin,
              high = origin;
            for (const bin of state.clockAnchors) {
              low = Math.min(low, bin.min);
              high = Math.max(high, bin.max);
            }
            state.clockProbe.maxRolling120sDriftMs = Math.max(
              state.clockProbe.maxRolling120sDriftMs,
              high - low,
            );
            const rawOrigin = data.contextEndSeconds * 1000 - (data.offset + 512) / 16;
            firstRawOrigin ??= rawOrigin;
            const skew =
              stamp.performanceTime +
              (context.currentTime - stamp.contextTime) * 1000 -
              performance.now();
            state.clockProbe.maxAbsRawMediaOriginShiftMs = Math.max(
              state.clockProbe.maxAbsRawMediaOriginShiftMs,
              Math.abs(rawOrigin - firstRawOrigin),
            );
            state.clockProbe.lastOutputPairSkewMs = skew;
            state.clockProbe.maxAbsOutputPairSkewMs = Math.max(
              state.clockProbe.maxAbsOutputPairSkewMs,
              Math.abs(skew),
            );
            if (previousEndSeconds !== undefined)
              state.clockProbe.maxContextFrameGapMs = Math.max(
                state.clockProbe.maxContextFrameGapMs,
                (data.contextEndSeconds - previousEndSeconds) * 1000 - 32,
              );
            previousEndSeconds = data.contextEndSeconds;
            state.clockProbe.frames++;
            state.clockProbe.lastOriginShiftMs = drift;
            state.clockProbe.maxAbsOriginShiftMs = Math.max(
              state.clockProbe.maxAbsOriginShiftMs,
              Math.abs(drift),
            );
          });
        }
      };
      window.Worker = class extends originalWorker {
        constructor(...args) {
          super(...args);
          state.liveWorkers++;
          state.peakWorkers = Math.max(state.peakWorkers, state.liveWorkers);
          this.benchClosed = false;
          this.addEventListener('error', () => state.workerErrors++);
          this.addEventListener('message', ({ data }) => {
            if (data?.type === 'error') state.workerErrors++;
            if (data?.segment && ['partial', 'result'].includes(data.type)) {
              const segment = data.segment;
              if (state.startedAt && !state.stopped && state.asrJobs.length < 12000)
                state.asrJobs.push({
                  start: segment.startMs,
                  end: segment.endMs,
                  work: segment.processingMs,
                });
              state.asrDeliverySpan =
                state.speechSpans.find(
                  (span) =>
                    span.startAt <= segment.endMs + 100 && span.endAt >= segment.startMs - 100,
                ) ?? null;
            }
            if (data?.type === 'ready' && data.executionProfile)
              state.asrExecutionProfile = data.executionProfile;
            if (data?.type === 'result' && Number.isFinite(data.processingMs)) {
              state.toneMeasurements.count++;
              state.toneMeasurements.totalMs += data.processingMs;
              state.toneMeasurements.maxMs = Math.max(
                state.toneMeasurements.maxMs,
                data.processingMs,
              );
            }
            if (data?.type === 'ready' && data.modelVersion?.includes('emotiefflib')) {
              state.classifierBackend =
                data.classifierBackend ??
                (data.modelVersion.includes('webgpu') ? 'webgpu' : 'wasm');
              state.detectorDelegate = data.detectorDelegate ?? null;
            }
          });
        }
        terminate() {
          if (!this.benchClosed) {
            state.liveWorkers--;
            this.benchClosed = true;
          }
          super.terminate();
        }
      };
      const metric = ({ detail }) => {
        // The application has already projected this event to numeric allowlisted fields.
        if (!state.startedAt || state.stopped) return;
        if (detail.stage === 'workload' && state.queueSamples.length < 3600)
          state.queueSamples.push({
            elapsedMs: performance.now() - state.startedAt,
            pendingFinal: detail.queue,
            oldestFinalWaitMs: detail.durationMs,
            rtf: detail.rtf,
          });
        const speech = state.asrDeliverySpan;
        if (
          speech &&
          detail.stage === 'partial-delivery' &&
          state.partialSpanStart !== speech.startAt
        ) {
          state.partialSpanStart = speech.startAt;
          state.fixtureCaptionLatencies.partial.push(
            Math.max(0, performance.now() - speech.startAt),
          );
        }
        if (speech && detail.stage === 'final-delivery')
          state.fixtureCaptionLatencies.final.push(Math.max(0, performance.now() - speech.endAt));
        const stage = (state.stages[detail.stage] ??= {
          count: 0,
          totalMs: 0,
          durations: [],
          usable: 0,
          queuePeak: 0,
          rtf: null,
          missedDeadlines: 0,
        });
        stage.count++;
        if (detail.stage === 'face-delivery' && state.faceTimes.length < 12000)
          state.faceTimes.push(performance.now() - state.startedAt);
        stage.totalMs += detail.durationMs;
        stage.missedDeadlines += detail.missedDeadlines ?? 0;
        if (stage.durations.length < 12000) stage.durations.push(detail.durationMs);
        if (detail.usable === true) stage.usable++;
        stage.queuePeak = Math.max(stage.queuePeak, detail.queue ?? 0);
        if (Number.isFinite(detail.rtf)) stage.rtf = detail.rtf;
      };
      window.addEventListener('signemo:pipeline-metric', metric);
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        state.captureCalls++;
        if (state.captureCalls > 1) throw new Error('Unexpected second capture');
        const response = await fetch('/research/benchmark/manifest.json');
        if (!response.ok) throw new Error('Missing licensed load fixtures');
        const manifest = await response.json();
        const verifiedBytes = async (url, expected, maximumBytes) => {
          if (!url.startsWith('/research/') || !/^[a-f0-9]{64}$/.test(expected))
            throw new Error('Invalid fixture contract');
          const response = await fetch(url);
          if (!response.ok) throw new Error('Missing fixture');
          const bytes = await response.arrayBuffer();
          if (bytes.byteLength > maximumBytes) throw new Error('Fixture exceeds bound');
          const actual = Array.from(
            new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
            (value) => value.toString(16).padStart(2, '0'),
          ).join('');
          if (actual !== expected) throw new Error('Fixture checksum mismatch');
          return bytes;
        };
        const imageBytes = await verifiedBytes(manifest.image, manifest.imageSha256, 2000000);
        const imageUrl = URL.createObjectURL(new Blob([imageBytes], { type: 'image/png' }));
        const image = new Image();
        image.src = imageUrl;
        await image.decode();
        URL.revokeObjectURL(imageUrl);
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const context = canvas.getContext('2d');
        const videoTrack = canvas.captureStream(0).getVideoTracks()[0];
        if (typeof videoTrack.requestFrame !== 'function')
          throw new Error('Explicit canvas frame capture required');
        const videoStartedAt = performance.now();
        const draw = () => {
          context.fillStyle = '#808080';
          context.fillRect(0, 0, 640, 480);
          // A controlled 300 ms loss every 15 s exercises reset/reacquisition after warm-up.
          if ((performance.now() - videoStartedAt) % 15000 < 300) {
            videoTrack.requestFrame();
            return;
          }
          // Source crop enlarges a real face; small motion still exercises detection each frame.
          context.drawImage(
            image,
            100,
            20,
            300,
            330,
            90 + 3 * Math.sin(performance.now() / 1000),
            0,
            440,
            480,
          );
          videoTrack.requestFrame();
        };
        draw();
        state.timers.push(setInterval(draw, 50));
        // Native fake device, verified in the owning Chrome command line above.
        // One application audio clock; no extra source AudioContext drifting against capture.
        const microphone = await originalCapture.call(navigator.mediaDevices, {
          audio: constraints?.audio ?? true,
          video: false,
        });
        state.audioStartedAt = performance.now() + 3000;
        const stream = new MediaStream([videoTrack, ...microphone.getAudioTracks()]);
        state.activeTracks.push(...stream.getTracks());
        return stream;
      };
      state.snapshot = () => ({
        elapsedMs: performance.now() - state.startedAt,
        jsHeapBytes: performance.memory?.usedJSHeapSize ?? null,
        attachedDomElements: document.getElementsByTagName('*').length,
        captionCounterVersion: 2,
        captionEntryNodes: document.querySelectorAll('.caption-entry').length,
        visibleFinalCaptions: document.querySelectorAll('.caption-entry:not(.provisional-caption)')
          .length,
        visibleProvisionalCaptions: document.querySelectorAll('.caption-entry.provisional-caption')
          .length,
        avatarCanvases: document.querySelectorAll('.face-avatar-canvas canvas').length,
        liveWorkers: state.liveWorkers,
        liveTracks: state.activeTracks.filter((track) => track.readyState === 'live').length,
        clockProbe: { ...state.clockProbe },
      });
      const asrWindow = () => {
        let end = -Infinity,
          audioMs = 0,
          processingMs = 0;
        for (const job of state.asrJobs.slice().sort((a, b) => a.start - b.start)) {
          audioMs += Math.max(0, job.end - Math.max(end, job.start));
          end = Math.max(end, job.end);
          processingMs += job.work;
        }
        return {
          jobCount: state.asrJobs.length,
          processingMs,
          audioMs,
          rtf: audioMs > 0 ? processingMs / audioMs : null,
        };
      };
      state.report = () => ({
        elapsedMs: state.elapsedMs ?? performance.now() - state.startedAt,
        startedAtUtc: state.startedAtUtc ?? null,
        peakWorkers: state.peakWorkers,
        liveWorkers: state.liveWorkers,
        liveTracks: state.activeTracks.filter((track) => track.readyState === 'live').length,
        openFixtureAudioContexts: state.contexts.filter((context) => context.state !== 'closed')
          .length,
        openApplicationAudioContexts: state.allContexts.filter(
          (context) => !state.contexts.includes(context) && context.state !== 'closed',
        ).length,
        workerErrors: state.workerErrors,
        clockProbe: { ...state.clockProbe },
        captureCalls: state.captureCalls,
        classifierBackend: state.classifierBackend,
        detectorDelegate: state.detectorDelegate,
        asrExecutionProfile: state.asrExecutionProfile,
        toneMeasurements: state.toneMeasurements,
        queueSamples: state.queueSamples,
        asrWindow: asrWindow(),
        fixtureCaptionLatencies: Object.fromEntries(
          Object.entries(state.fixtureCaptionLatencies).map(([name, values]) => {
            const sorted = values.slice().sort((a, b) => a - b);
            return [
              name,
              { count: sorted.length, p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? null },
            ];
          }),
        ),
        samples: state.samples,
        stages: Object.fromEntries(
          Object.entries(state.stages).map(([name, stage]) => {
            const sorted = stage.durations.slice().sort((a, b) => a - b);
            return [
              name,
              {
                count: stage.count,
                totalMs: stage.totalMs,
                retained: sorted.length,
                truncated: stage.count > sorted.length,
                p50Ms: sorted[Math.ceil(sorted.length * 0.5) - 1] ?? null,
                p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? null,
                usable: stage.usable,
                queuePeak: stage.queuePeak,
                rtf: stage.rtf,
                missedDeadlines: stage.missedDeadlines,
              },
            ];
          }),
        ),
        faceWindows: Array.from({ length: Math.floor(state.elapsedMs / 10000) }, (_, i) => ({
          startMs: i * 10000,
          hz: state.faceTimes.filter((at) => at >= i * 10000 && at < (i + 1) * 10000).length / 10,
          sourceHz:
            state.sourceFrameTimes.filter((at) => at >= i * 10000 && at < (i + 1) * 10000).length /
            10,
        })),
      });
      state.cleanup = async () => {
        await state.wakeLock?.release().catch(() => {});
        state.sourceVideo?.cancelVideoFrameCallback?.(state.sourceFrameCallback);
        state.stopped = true;
        state.timers.forEach(clearInterval);
        state.sources.forEach((source) => {
          try {
            source.stop();
          } catch {}
          source.disconnect();
        });
        state.activeTracks.forEach((track) => track.stop());
        await Promise.all(
          state.contexts.map((context) =>
            context.state === 'closed' ? undefined : context.close(),
          ),
        );
        window.removeEventListener('signemo:pipeline-metric', metric);
        window.Worker = originalWorker;
        window.AudioWorkletNode = originalWorkletNode;
        window.AudioContext = originalAudioContext;
        navigator.mediaDevices.getUserMedia = originalCapture;
      };
    });
    await page.goto(target.href);
    const intro = page.getByRole('button', { name: 'Vào hội thoại', exact: true });
    await intro.waitFor();
    await intro.click();
    if (target.searchParams.get('history') === '1') {
      await page.getByRole('checkbox', {name:'Lưu hội thoại trên thiết bị',exact:true}).check();
      await page.getByLabel('Tạo mật khẩu lịch sử', {exact:true}).fill('SignEmo-QA-only-2026');
      await page.getByRole('button', {name:'Tạo kho để lưu',exact:true}).click();
      await page.getByRole('status').filter({hasText:'Sẽ tự lưu khi có lời nói'}).waitFor();
    }
    await page.getByRole('checkbox', { name: /Tôi từ 18 tuổi/ }).check();
    await page.locator('.session-options > details > summary').click();
    if (target.searchParams.has('avatar')) {
      await page
        .getByRole('checkbox', { name: /Dùng đầu 3D cho minh họa nét mặt|Minh họa nét mặt có chiều sâu/ })
        .setChecked(target.searchParams.get('avatar') === '1');
    }
    if (target.searchParams.get('tone') === '1') {
      await page
        .getByRole('checkbox', { name: /Thử tone giọng trong tổng hợp/ })
        .check({ timeout: 240000 });
      await page
        .getByText('Tone đã sẵn sàng · chưa kiểm chứng chất lượng tiếng Việt.', { exact: true })
        .waitFor({ timeout: 300000 });
    }
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
    await page
      .getByRole('checkbox', { name: 'Thử gợi ý tổng hợp', exact: true })
      .check({ timeout: 240000 });
    const start = page.getByRole('button', { name: 'Bắt đầu hội thoại', exact: true });
    await start.waitFor();
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('button')].some(
          (button) => button.textContent.includes('Bắt đầu hội thoại') && !button.disabled,
        ),
      null,
      { timeout: 240000 },
    );
    await start.click();
    const stop = page.getByRole('button', { name: 'Kết thúc hội thoại', exact: true });
    await stop.waitFor({ timeout: 30000 });
    await page.evaluate(async () => {
      if (navigator.wakeLock)
        pipelineBench.wakeLock = await navigator.wakeLock.request('screen').catch(() => null);
    });
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (!video?.requestVideoFrameCallback) throw new Error('Missing source frame observer');
      pipelineBench.sourceVideo = video;
      const observe = (now) => {
        if (pipelineBench.stopped) return;
        if (pipelineBench.startedAt && pipelineBench.sourceFrameTimes.length < 60000)
          pipelineBench.sourceFrameTimes.push(now - pipelineBench.startedAt);
        pipelineBench.sourceFrameCallback = video.requestVideoFrameCallback(observe);
      };
      pipelineBench.sourceFrameCallback = video.requestVideoFrameCallback(observe);
    });
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(5000);
      if (!(await stop.isVisible()))
        throw new Error('Session stopped during full-pipeline warm-up');
    }
    await page.evaluate(() => {
      pipelineBench.clockEpoch++;
      pipelineBench.clockAnchors.length = 0;
      for (const key of Object.keys(pipelineBench.clockProbe)) pipelineBench.clockProbe[key] = 0;
      pipelineBench.startedAt = performance.now();
      pipelineBench.startedAtUtc = new Date().toISOString();
    });
    await sampleMemory();
    let elapsedMs = 0;
    let nextSnapshot = 60000;
    while (elapsedMs < seconds * 1000) {
      await page.waitForTimeout(Math.min(5000, seconds * 1000 - elapsedMs));
      elapsedMs = await page.evaluate(() => performance.now() - pipelineBench.startedAt);
      if (!(await stop.isVisible())) {
        report = { status: 'incomplete', reason: 'session-stopped-before-deadline' };
        throw new Error('Session stopped before deadline');
      }
      if (elapsedMs >= 120000 && !(await page.evaluate(() => pipelineBench.stages.text?.count > 0)))
        throw new Error('Text branch did not run in the first two minutes');
      if (elapsedMs >= nextSnapshot) {
        const snapshot = await sampleMemory();
        console.log(
          JSON.stringify({ minute: Math.floor(snapshot.elapsedMs / 60000), ...snapshot }),
        );
        nextSnapshot += 60000;
      }
    }
    await page.evaluate(() => {
      pipelineBench.elapsedMs = performance.now() - pipelineBench.startedAt;
    });
    await sampleMemory();
    await stop.click();
    await page.waitForFunction(
      () =>
        !document.querySelector('button') ||
        ![...document.querySelectorAll('button')].some((button) =>
          button.textContent.includes('Kết thúc hội thoại'),
        ),
      null,
      { timeout: 75000 },
    );
    // Allow async close/worker cancellation to settle; do not use pagehide to
    // conceal resources retained after an ordinary Finish.
    await page.waitForTimeout(1000);
    afterFinish = await page.evaluate(() => ({
      avatarCanvases: document.querySelectorAll('.face-avatar-canvas canvas').length,
      liveWorkers: pipelineBench.liveWorkers,
      liveTracks: pipelineBench.activeTracks.filter((track) => track.readyState === 'live').length,
      openApplicationAudioContexts: pipelineBench.allContexts.filter(
        (context) => !pipelineBench.contexts.includes(context) && context.state !== 'closed',
      ).length,
    }));
    // Include workers spawned inside the WASM worker (pthread), beyond the
    // Window.Worker wrapper's count. Persistent PWA service workers are excluded.
    const targetCleanupStarted = Date.now();
    const targetCounts = [];
    do {
      const targets = await cdp.send('Target.getTargets');
      const inferenceTargets = targets.targetInfos.filter(
        (info) =>
          ['worker', 'shared_worker'].includes(info.type) &&
          info.url.startsWith(target.origin + '/'),
      );
      afterFinish.inferenceWorkerTargets = inferenceTargets.length;
      afterFinish.remainingWorkerPaths = inferenceTargets.map((info) => new URL(info.url).pathname);
      targetCounts.push({
        elapsedMs: Date.now() - targetCleanupStarted,
        count: afterFinish.inferenceWorkerTargets,
      });
      if (afterFinish.inferenceWorkerTargets === 0) break;
      await page.waitForTimeout(100);
    } while (Date.now() - targetCleanupStarted < 6000);
    afterFinish.workerTargetCleanup = {
      timeoutMs: 6000,
      observations: targetCounts,
    };
    // Dispose idle prepared workers by leaving the app. Instrumentation survives in this document.
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.waitForTimeout(1000);
  } catch {
    report ??= { status: 'incomplete', reason: 'session-or-fixture-failed' };
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))).catch(() => {});
  } finally {
    const beforeHarnessCleanup = await page
      .evaluate(() => window.pipelineBench?.report())
      .catch(() => null);
    const measurements = await page
      .evaluate(async () => {
        if (!window.pipelineBench) return null;
        await pipelineBench.cleanup();
        return pipelineBench.report();
      })
      .catch(() => null);
    const stages = measurements?.stages;
    const exercised = !!(
      stages?.classifier?.count &&
      stages?.['asr-final']?.count &&
      stages?.text?.count
    );
    report = {
      ...report,
      status: report?.status ?? (exercised ? 'completed' : 'incomplete'),
      reason: report?.reason ?? (exercised ? null : 'required-branch-not-exercised'),
      scope:
        'Synthetic load: public-domain NASA portrait with pan + 2-second public FLEURS audio loop. Face and voice are different people. No emotion accuracy, true conversation, thermal, VRAM or Android validation.',
      requestedSeconds: seconds,
      fullPipelineWarmupSeconds: 30,
      afterFinish,
      finishTeardownPassed:
        !!afterFinish &&
        afterFinish.avatarCanvases === 0 &&
        afterFinish.inferenceWorkerTargets === 0 &&
        afterFinish.liveWorkers === 0 &&
        afterFinish.liveTracks === 0 &&
        afterFinish.openApplicationAudioContexts === 0,
      buildProfile: 'pc-candidate (selected ASR / B0-WebGPU / PhoBERT)',
      asrProfile: await page.evaluate(
        () =>
          [...document.querySelectorAll('select')]
            .map((select) => select.value)
            .find((value) =>
              ['gipformer-research', 'moonshine-streaming-vi-research', 'product'].includes(value),
            ) ?? 'unknown',
      ),
      measurements,
      network,
      pageErrors: pageErrors.count,
      hardwareValidation: false,
      accuracyValidation: false,
      productionAcceptancePassed: false,
      totalPipelinePeakMemoryBytes: null,
      observedFaceHz:
        stages?.['face-delivery']?.count && measurements?.elapsedMs
          ? (stages['face-delivery'].count * 1000) / measurements.elapsedMs
          : null,
      clockValidForLatency:
        !!measurements &&
        measurements.clockProbe.frames > 0 &&
        measurements.clockProbe.maxRolling120sDriftMs <= 100,
      memoryScope:
        'CDP heap/DOM counters are for the main renderer only. Worker/WASM/VRAM are not included. DOM count includes detached nodes until collection; attached elements and final caption nodes are reported separately. No forced GC.',
      browser: await page.evaluate(() => ({
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemoryGiB: navigator.deviceMemory ?? null,
        isolated: crossOriginIsolated,
        buildId: document.querySelector('[data-build]')?.getAttribute('data-build') ?? null,
      })),
      applicationTeardownPassed:
        !!beforeHarnessCleanup &&
        beforeHarnessCleanup.liveWorkers === 0 &&
        beforeHarnessCleanup.liveTracks === 0 &&
        beforeHarnessCleanup.openApplicationAudioContexts === 0,
      teardownPassed:
        !!measurements &&
        measurements.liveWorkers === 0 &&
        measurements.liveTracks === 0 &&
        measurements.openApplicationAudioContexts === 0 &&
        measurements.openFixtureAudioContexts === 0,
    };
    page.off('request', onRequest);
    page.off('pageerror', onError);
    await cdp.detach();
  }
  if (target.searchParams.get('history') === '1') {
    if (await page.getByLabel('Mật khẩu lịch sử',{exact:true}).isVisible()) {
      await page.getByLabel('Mật khẩu lịch sử',{exact:true}).fill('SignEmo-QA-only-2026');
      await page.getByRole('button',{name:'Mở khóa để lưu',exact:true}).click();
    }
    await page.getByRole('status').filter({hasText:'Đã lưu trên thiết bị'}).waitFor({timeout:30000});
    await page.getByRole('button',{name:'Lịch sử',exact:true}).click();
    await page.locator('.history-record').first().waitFor();
    const before = await page.locator('.history-record .transcript-history p').allTextContents();
    const encrypted = await page.evaluate(() => new Promise((resolve,reject) => {
      const request = indexedDB.open('signemo-v1');
      request.onerror = () => reject(new Error('Cannot inspect test storage'));
      request.onsuccess = () => {
        const database = request.result;
        const read = database.transaction('conversations','readonly').objectStore('conversations').getAll();
        read.onsuccess = () => { resolve(read.result.length > 0 && read.result.every((row) => Object.keys(row).every((key) => ['id','expiresAt','iv','data'].includes(key)))); database.close(); };
        read.onerror = () => { database.close(); reject(new Error('Cannot inspect test record')); };
      };
    }));
    await page.reload();
    await page.getByRole('button',{name:'Lịch sử',exact:true}).click();
    await page.getByLabel('Mật khẩu',{exact:true}).fill('SignEmo-QA-only-2026');
    await page.getByRole('button',{name:'Mở khóa',exact:true}).click();
    await page.locator('.history-record').first().waitFor();
    const after = await page.locator('.history-record .transcript-history p').allTextContents();
    report.history = {finalCount:before.length, retainedAfterReload:JSON.stringify(before) === JSON.stringify(after), encrypted};
    if (!before.length || !report.history.retainedAfterReload || !encrypted) throw new Error('Encrypted history regression failed');
  }
  const download = page.waitForEvent('download');
  await page.evaluate((report) => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pipeline-benchmark.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, report);
  await (await download).saveAs(target.searchParams.get('history') === '1' ? 'output/research-evaluation/pipeline-history-benchmark.json' : 'output/research-evaluation/pipeline-benchmark.json');
  return report;
};
