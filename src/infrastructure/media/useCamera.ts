import { useCallback, useEffect, useRef, useState } from 'react';
import { FramePacer, RecentFaceTiming } from '../../domain/face/framePacer';
import { detectorDelegate } from '../inference/executionProfile';
import {
  MODEL_VERSION,
  type Expression,
  type HapticEvent,
  type InferenceResult,
  type SessionMetrics,
  type Settings,
} from '../../shared/contracts';
import { PredictionGate, emptyResult, percentile } from '../../domain/face/prediction';
import { elapsedMs, frameLatencyMs } from '../../domain/face/frameTiming';
import type { AuxiliaryArtifact } from '../inference/auxiliary';
import { makeWorkerReady } from '../inference/workerReady';
import { emitAudit } from '../audit/log';
import { emitPipelineMetric } from '../diagnostics/pipelineTelemetry';
import faceWorkerUrl from '../inference/face.worker.ts?worker&url';
import gpuFaceWorkerUrl from '../inference/face-gpu.worker.ts?worker&url';
import { faceProfileContract, type FaceModelProfile } from '../inference/face-model-profile';
import { prepareResearchGpuRuntime } from '../inference/researchGpuRuntime';
import {
  modelInitializationCode,
  type ModelInitializationCode,
} from '../../domain/modelInitialization';

export function useCamera(
  settings: Settings,
  onHaptic: (label: Expression) => HapticEvent | null,
  candidate?: AuxiliaryArtifact | null,
  frameIntervalMs = 200,
  faceProfile: FaceModelProfile = 'product',
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const preparedWorkerRef = useRef<Worker | null>(null);
  const preparingWorkerRef = useRef<Worker | null>(null);
  const preparingPromiseRef = useRef<Promise<boolean> | null>(null);
  const preparingAbortRef = useRef<AbortController | null>(null);
  const preparationGeneration = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameCallbackRef = useRef<number | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startupResolver = useRef<((ready: boolean) => void) | null>(null);
  const generation = useRef(0);
  const frameRequest = useRef(0);
  const activeFrameRequest = useRef(0);
  const switching = useRef(false);
  const pumpFrame = useRef<(() => Promise<void>) | null>(null);
  const busy = useRef(false);
  const pacer = useRef(new FramePacer());
  const recentTiming = useRef(new RecentFaceTiming());
  const running = useRef(false);
  const gate = useRef(new PredictionGate(settings));
  const callbackRef = useRef(onHaptic);
  callbackRef.current = onHaptic;
  const candidateRef = useRef(candidate);
  candidateRef.current = candidate?.manifest.approved ? candidate : null;
  const [state, setState] = useState<'idle' | 'loading' | 'running'>('idle');
  const [error, setError] = useState('');
  const preparationFailure = useRef<ModelInitializationCode>('worker');
  const [isSwitching, setIsSwitching] = useState(false);
  const [preparingAI, setPreparingAI] = useState(false);
  const clearError = useCallback(() => setError(''), []);
  const [result, setResult] = useState<InferenceResult>(emptyResult());
  const renderedLabel = useRef<Expression | null>(null);
  useEffect(() => {
    if (result.status === 'valid' && result.label) {
      emitPipelineMetric({
        stage: 'face-render',
        durationMs: Math.max(0, performance.now() - result.timestamp),
      });
      if (renderedLabel.current !== result.label) {
        emitPipelineMetric({
          stage: 'face-label-render',
          durationMs: Math.max(
            0,
            performance.now() - (gate.current.candidateTimestamp() ?? result.timestamp),
          ),
        });
        renderedLabel.current = result.label;
      }
    } else if (result.decisionReason !== 'stabilizing') renderedLabel.current = null;
  }, [result]);
  const started = useRef(0);
  const durations = useRef<number[]>([]);
  const counters = useRef({
    processedFrames: 0,
    invalidFrames: 0,
    uncertainFrames: 0,
    hapticCount: 0,
  });
  const metrics = useRef<SessionMetrics | null>(null);
  const modelVersion = useRef<string>(MODEL_VERSION);
  const intervalRef = useRef(frameIntervalMs);
  useEffect(() => {
    gate.current.configure(settings);
    setResult(emptyResult());
  }, [settings]);
  const stop = useCallback(() => {
    generation.current++;
    startupResolver.current?.(false);
    startupResolver.current = null;
    running.current = false;
    busy.current = false;
    pacer.current.reset();
    recentTiming.current.clear();
    switching.current = false;
    pumpFrame.current = null;
    setIsSwitching(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    if (frameCallbackRef.current !== null) {
      videoRef.current?.cancelVideoFrameCallback?.(frameCallbackRef.current);
      frameCallbackRef.current = null;
    }
    if (watchdogRef.current) clearTimeout(watchdogRef.current);
    if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    workerRef.current?.terminate();
    workerRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (started.current) {
      metrics.current = {
        ...counters.current,
        durationMs: performance.now() - started.current,
        p50Ms: percentile(durations.current, 0.5),
        p95Ms: percentile(durations.current, 0.95),
      };
      started.current = 0;
    }
    gate.current.reset();
    setState('idle');
    setResult(emptyResult());
  }, []);
  const disposePrepared = useCallback(() => {
    preparationGeneration.current++;
    preparingAbortRef.current?.abort();
    preparingAbortRef.current = null;
    preparingWorkerRef.current?.terminate();
    preparingWorkerRef.current = null;
    preparedWorkerRef.current?.terminate();
    preparedWorkerRef.current = null;
    preparingPromiseRef.current = null;
    setPreparingAI(false);
  }, []);
  const prepare = useCallback(() => {
    if (preparedWorkerRef.current) return Promise.resolve(true);
    if (preparingPromiseRef.current) return preparingPromiseRef.current;
    const worker = new Worker(
      faceProfileContract(faceProfile).backend === 'webgpu' ? gpuFaceWorkerUrl : faceWorkerUrl,
      {
        type: 'module',
      },
    );
    const rememberVersion = (event: MessageEvent) => {
      if (event.data.type === 'ready' && typeof event.data.modelVersion === 'string')
        modelVersion.current = event.data.modelVersion;
    };
    worker.addEventListener('message', rememberVersion);
    const request = ++preparationGeneration.current;
    const abort = new AbortController();
    preparingWorkerRef.current = worker;
    preparingAbortRef.current = abort;
    setPreparingAI(true);
    setError('');
    const preparation = (
      faceProfileContract(faceProfile).backend === 'webgpu'
        ? prepareResearchGpuRuntime(abort.signal)
        : Promise.resolve()
    )
      .then(() =>
        makeWorkerReady(
          worker,
          {
            type: 'init',
            candidate: candidateRef.current ?? undefined,
            research: faceProfile !== 'product',
            faceProfile,
            detectorDelegate: faceProfile.includes('webgpu') ? detectorDelegate() : 'CPU',
          },
          abort.signal,
        ),
      )
      .then(() => {
        if (request !== preparationGeneration.current || preparingWorkerRef.current !== worker) {
          worker.terminate();
          return false;
        }
        preparedWorkerRef.current = worker;
        preparingWorkerRef.current = null;
        return true;
      })
      .catch((error: unknown) => {
        preparationFailure.current = modelInitializationCode(error);
        worker.terminate();
        if (request === preparationGeneration.current) {
          preparingWorkerRef.current = null;
          setError('Chưa khởi động được nhận diện khuôn mặt. Hãy thử chuẩn bị lại.');
        }
        return false;
      })
      .finally(() => {
        worker.removeEventListener('message', rememberVersion);
        if (request === preparationGeneration.current) {
          preparingAbortRef.current = null;
          preparingPromiseRef.current = null;
          setPreparingAI(false);
        }
      });
    preparingPromiseRef.current = preparation;
    return preparation;
  }, [faceProfile]);
  const start = useCallback(
    async (facing: 'user' | 'environment', providedStream?: MediaStream) => {
      stop();
      const current = generation.current;
      setError('');
      setState('loading');
      try {
        if (!window.isSecureContext) throw new Error('Camera cần HTTPS hoặc localhost.');
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error('Trình duyệt chưa hỗ trợ camera.');
        const stream =
          providedStream ??
          (await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: facing }, width: { ideal: 640 }, height: { ideal: 480 } },
          }));
        if (current !== generation.current) {
          stream.getTracks().forEach((t) => t.stop());
          return false;
        }
        if (!stream.getVideoTracks().length)
          throw new Error('Không tìm thấy camera trong luồng đã cấp quyền.');
        streamRef.current = stream;
        stream.getVideoTracks()[0].addEventListener(
          'ended',
          () => {
            stop();
            setError('Camera đã ngắt. Hãy bắt đầu lại.');
          },
          { once: true },
        );
        if (!videoRef.current) throw new Error('Chưa tìm thấy vùng hiển thị camera');
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (current !== generation.current) return false;
        const worker =
          preparedWorkerRef.current ??
          new Worker(
            faceProfileContract(faceProfile).backend === 'webgpu'
              ? gpuFaceWorkerUrl
              : faceWorkerUrl,
            {
              type: 'module',
            },
          );
        const alreadyPrepared = preparedWorkerRef.current === worker;
        if (alreadyPrepared) preparedWorkerRef.current = null;
        workerRef.current = worker;
        let resolveStartup!: (ready: boolean) => void;
        const startup = new Promise<boolean>((resolve) => {
          resolveStartup = (ready) => {
            if (startupResolver.current === resolveStartup) startupResolver.current = null;
            resolve(ready);
          };
          startupResolver.current = resolveStartup;
        });
        const fail = (message: string) => {
          if (current !== generation.current) return;
          emitAudit('worker-failed', {
            branch: 'face',
            reason: message.includes('quá lâu') ? 'timeout' : 'worker-failed',
          });
          resolveStartup(false);
          stop();
          setError(message);
        };
        const schedule = () => {
          if (timeoutRef.current || frameCallbackRef.current !== null || !running.current) return;
          timeoutRef.current = setTimeout(
            () => {
              timeoutRef.current = null;
              const video = videoRef.current;
              if (video && typeof video.requestVideoFrameCallback === 'function') {
                frameCallbackRef.current = video.requestVideoFrameCallback(() => {
                  frameCallbackRef.current = null;
                  void frame();
                });
              } else void frame();
            },
            videoRef.current?.requestVideoFrameCallback ? 0 : 16,
          );
        };
        const frame = async () => {
          if (running.current && !switching.current) schedule();
          if (
            !running.current ||
            busy.current ||
            switching.current ||
            current !== generation.current
          )
            return;
          const video = videoRef.current;
          if (!video || video.readyState < 2) {
            schedule();
            return;
          }
          if (
            !pacer.current.take(
              performance.now(),
              video.currentTime,
              busy.current,
              intervalRef.current,
            )
          )
            return;
          busy.current = true;
          emitPipelineMetric({
            stage: 'face-schedule-wait',
            durationMs: pacer.current.latenessMs,
            missedDeadlines: pacer.current.missedDeadlines,
          });
          const capturedAt = performance.now();
          try {
            const bitmap = await createImageBitmap(video);
            const captureMs = elapsedMs(capturedAt, performance.now());
            if (current !== generation.current) {
              bitmap.close();
              return;
            }
            watchdogRef.current = setTimeout(
              () => fail('Xử lý camera quá lâu. Hãy thử lại hoặc đổi thiết bị.'),
              12_000,
            );
            const requestId = ++frameRequest.current;
            activeFrameRequest.current = requestId;
            worker.postMessage(
              { type: 'frame', bitmap, timestamp: capturedAt, captureMs, requestId },
              [bitmap],
            );
          } catch {
            fail('Không đọc được khung hình camera. Hãy thử Chrome mới nhất.');
          }
        };
        pumpFrame.current = frame;
        worker.onmessage = (event: MessageEvent) => {
          if (current !== generation.current) return;
          if (event.data.type === 'ready') {
            modelVersion.current = event.data.modelVersion;
            if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
            counters.current = {
              processedFrames: 0,
              invalidFrames: 0,
              uncertainFrames: 0,
              hapticCount: 0,
            };
            durations.current = [];
            metrics.current = null;
            started.current = performance.now();
            running.current = true;
            setState('running');
            resolveStartup(true);
            void frame();
          }
          if (event.data.type === 'result') {
            if (watchdogRef.current) clearTimeout(watchdogRef.current);
            busy.current = false;
            if (event.data.requestId !== activeFrameRequest.current) {
              if (!switching.current && running.current) schedule();
              return;
            }
            const inferenceResult = event.data.result as InferenceResult;
            const input = {
              ...inferenceResult,
              captureMs: Number.isFinite(inferenceResult.captureMs) ? inferenceResult.captureMs : 0,
            };
            // Include frame capture, worker scheduling, inference and result delivery.
            const elapsed = frameLatencyMs(
              input.timestamp,
              input.captureMs ?? 0,
              input.processingMs,
              performance.now(),
            );
            recentTiming.current.add(performance.now(), elapsed);
            const maxFaceLatencyMs = faceProfile.includes('webgpu') ? 750 : 1200;
            emitPipelineMetric({
              stage: 'face-delivery',
              durationMs: elapsed,
              usable: input.observationUsable === true && elapsed <= maxFaceLatencyMs,
            });
            emitPipelineMetric({ stage: 'capture', durationMs: input.captureMs ?? 0 });
            for (const [stage, durationMs] of Object.entries(input.stages ?? {})) {
              const name = { detectionMs: 'detection', cropMs: 'crop', classifierMs: 'classifier' }[
                stage
              ];
              if (name && durationMs > 0)
                emitPipelineMetric({
                  stage: name as 'detection' | 'crop' | 'classifier',
                  durationMs,
                });
            }
            if (elapsed > maxFaceLatencyMs) {
              gate.current.clear();
              const stale = {
                ...input,
                label: null,
                status: 'uncertain' as const,
                decisionReason: 'stale-result' as const,
                latencyMs: elapsed,
              };
              setResult(stale);
              counters.current.processedFrames++;
              counters.current.uncertainFrames++;
              durations.current.push(elapsed);
              schedule();
              return;
            }
            const gated = gate.current.update(input);
            setResult({ ...gated.result, latencyMs: elapsed });
            counters.current.processedFrames++;
            if (input.status !== 'valid') counters.current.invalidFrames++;
            else if (gated.result.status === 'uncertain') counters.current.uncertainFrames++;
            durations.current.push(elapsed);
            if (durations.current.length > 9000) durations.current.shift();
            if (gated.trigger && gated.trigger !== 'neutral') {
              const event = callbackRef.current(gated.trigger);
              if (event?.apiAccepted) counters.current.hapticCount++;
            }
            schedule();
          }
          if (event.data.type === 'error') fail(`Không thể khởi chạy AI: ${event.data.message}`);
        };
        worker.onerror = () =>
          fail('Worker AI không khởi chạy được. Kiểm tra model/runtime và thử tải lại.');
        initTimeoutRef.current = setTimeout(
          () => fail('Model chưa khởi chạy sau 90 giây. Hãy kiểm tra tài nguyên hoặc thiết bị.'),
          90_000,
        );
        if (alreadyPrepared) {
          if (initTimeoutRef.current) clearTimeout(initTimeoutRef.current);
          counters.current = {
            processedFrames: 0,
            invalidFrames: 0,
            uncertainFrames: 0,
            hapticCount: 0,
          };
          durations.current = [];
          metrics.current = null;
          started.current = performance.now();
          running.current = true;
          setState('running');
          resolveStartup(true);
          void frame();
        } else {
          worker.postMessage({
            type: 'init',
            candidate: candidateRef.current ?? undefined,
            research: faceProfile !== 'product',
            faceProfile,
            detectorDelegate: faceProfile.includes('webgpu') ? detectorDelegate() : 'CPU',
          });
        }
        return await startup;
      } catch (err) {
        if (current !== generation.current) return false;
        stop();
        const name = err instanceof DOMException ? err.name : '';
        setError(
          name === 'NotAllowedError'
            ? 'Bạn chưa cấp quyền camera. Cho phép camera trong cài đặt trình duyệt rồi thử lại.'
            : name === 'NotFoundError'
              ? 'Không tìm thấy camera trên thiết bị.'
              : name === 'NotReadableError'
                ? 'Camera đang được ứng dụng khác sử dụng hoặc không truy cập được.'
                : err instanceof Error
                  ? err.message
                  : 'Không thể mở camera.',
        );
        return false;
      }
    },
    [stop, faceProfile],
  );
  const switchCamera = useCallback(async () => {
    if (!running.current || switching.current || !streamRef.current) return false;
    const current = generation.current;
    const video = videoRef.current;
    const oldStream = streamRef.current;
    if (!video) return false;
    switching.current = true;
    pacer.current.reset();
    recentTiming.current.clear();
    setIsSwitching(true);
    setError('');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    if (frameCallbackRef.current !== null) {
      video.cancelVideoFrameCallback?.(frameCallbackRef.current);
      frameCallbackRef.current = null;
    }
    activeFrameRequest.current = ++frameRequest.current;
    gate.current.reset();
    setResult(emptyResult());
    let replacement: MediaStream | null = null;
    try {
      const devices = navigator.mediaDevices.enumerateDevices
        ? (await navigator.mediaDevices.enumerateDevices()).filter(
            (device) => device.kind === 'videoinput',
          )
        : [];
      if (current !== generation.current) return false;
      const currentTrack = oldStream.getVideoTracks()[0];
      if (!currentTrack || currentTrack.readyState !== 'live')
        throw new Error('Camera hiện tại đã ngắt. Hãy bắt đầu lại hội thoại.');
      if (devices.length < 2) throw new Error('Thiết bị chỉ có một camera.');
      const currentDeviceId = currentTrack.getSettings().deviceId;
      const currentIndex = devices.findIndex((device) => device.deviceId === currentDeviceId);
      const nextDevice = devices[(Math.max(0, currentIndex) + 1) % devices.length];
      if (!nextDevice || nextDevice.deviceId === currentDeviceId)
        throw new Error('Không tìm thấy camera khác để chuyển.');
      replacement = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          deviceId: { exact: nextDevice.deviceId },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      if (current !== generation.current) {
        replacement.getTracks().forEach((track) => track.stop());
        return false;
      }
      if (!replacement.getVideoTracks().length) throw new Error('Không tìm thấy camera để chuyển.');
      video.srcObject = replacement;
      await video.play();
      if (current !== generation.current) {
        replacement.getTracks().forEach((track) => track.stop());
        return false;
      }
      const activeStream = replacement;
      streamRef.current = activeStream;
      oldStream.getTracks().forEach((track) => track.stop());
      activeStream.getVideoTracks()[0].addEventListener(
        'ended',
        () => {
          stop();
          setError('Camera đã ngắt. Hãy bắt đầu lại.');
        },
        { once: true },
      );
      return true;
    } catch (cause) {
      replacement?.getTracks().forEach((track) => track.stop());
      if (current === generation.current) {
        const oldVideoTrack = oldStream.getVideoTracks()[0];
        if (oldVideoTrack?.readyState === 'live') {
          if (video.srcObject !== oldStream) {
            video.srcObject = oldStream;
            void video.play().catch(() => {});
          }
          setError(cause instanceof Error ? cause.message : 'Không thể đổi camera.');
        } else {
          stop();
          setError('Camera đã ngắt khi đổi thiết bị. Hãy bắt đầu lại hội thoại.');
        }
      }
      return false;
    } finally {
      if (current === generation.current) {
        switching.current = false;
        setIsSwitching(false);
        if (running.current) void pumpFrame.current?.();
      }
    }
  }, [stop]);
  const setFrameIntervalMs = useCallback((value: number) => {
    if (Number.isFinite(value)) intervalRef.current = Math.min(1000, Math.max(200, value));
  }, []);
  const getLiveP95 = useCallback(() => percentile(durations.current.slice(-60), 0.95), []);
  const getRecentServiceMs = useCallback(() => recentTiming.current.mean(performance.now()), []);
  useEffect(() => {
    disposePrepared();
    return disposePrepared;
  }, [candidate, faceProfile, disposePrepared]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) stop();
    };
    const end = () => stop();
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', end);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', end);
      stop();
    };
  }, [stop]);
  return {
    videoRef,
    state,
    preparingAI,
    prepare,
    getPreparationFailure: () => preparationFailure.current,
    disposePrepared,
    switching: isSwitching,
    error,
    clearError,
    result,
    start,
    stop,
    getMetrics: () => metrics.current,
    getLiveP95,
    getRecentServiceMs,
    getModelVersion: () => modelVersion.current,
    recordHaptic: (event: HapticEvent | null) => {
      if (event?.apiAccepted) counters.current.hapticCount++;
    },
    switchCamera,
    setFrameIntervalMs,
  };
}
