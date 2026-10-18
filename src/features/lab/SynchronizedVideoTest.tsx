import { useEffect, useRef, useState } from 'react';
import { PartialCaptionStabilizer } from '../../domain/partialCaption';
import {
  FaceInferenceBudget,
  baselineFusion,
  speechFusionCandidates,
  type FusionProfile,
  fuse,
  type FusionDecision,
  type ModalityEvidence,
  type TranscriptSegment,
} from '../../domain/conversation';
import { reviseCaption, isSuspiciousRecognition } from '../../domain/captionRevision';
import { FaceWindow } from '../../domain/faceWindow';
import { mapAudioSampleToMediaMs } from '../../domain/videoSync';
import { PredictionGate, emptyResult } from '../../domain/face/prediction';
import { youtubeId } from '../../domain/evaluation';
import type { SpeechAudioQuality, SpeechChunk } from '../../domain/audio';
import type { ProsodySummary } from '../../domain/prosody';
import { SpeechContext } from '../../domain/speechContext';
import { AsrWorkload } from '../../domain/asr';
import { ResearchOptions, useLabResearch } from './ResearchOptions';
import { emitAudit } from '../../infrastructure/audit/log';
import { InferenceClient } from '../../infrastructure/inference/videoInference';
import { makeWorkerReady } from '../../infrastructure/inference/workerReady';
import captureUrl from '../../infrastructure/media/capture.worklet?worker&url';
import { expressionUI, type Settings, type InferenceResult } from '../../shared/contracts';
import { Diagnostics, resultExplanation } from '../face/Diagnostics';
import './SynchronizedVideoTest.css';

interface AsrJob {
  id: string;
  samples: Float32Array;
  startMs: number;
  endMs: number;
  quality: SpeechAudioQuality;
  epoch: number;
  boundary?: TranscriptSegment['boundary'];
  utteranceId?: string;
  prosody?: ProsodySummary;
  partial?: boolean;
  revision?: number;
}

interface EmotionJob {
  segment: TranscriptSegment;
  epoch: number;
  quality: SpeechAudioQuality;
  prosody?: ProsodySummary;
}

interface CaptionRow {
  segment: TranscriptSegment;
  decision: FusionDecision | null;
  analyzing: boolean;
}

interface AudioGraph {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  workletLoaded: boolean;
}

interface Runtime {
  partialDisplay: PartialCaptionStabilizer;
  context: SpeechContext;
  load: AsrWorkload;
  fusion: FusionProfile;
  generation: number;
  video: HTMLVideoElement;
  face: InferenceClient;
  vad: Worker;
  asr: Worker;
  emotion?: Worker;
  emotionAvailable: boolean;
  vadAvailable: boolean;
  audioGraph?: AudioGraph;
  capture?: AudioWorkletNode;
  silence?: GainNode;
  active: boolean;
  isPlaying: boolean;
  hasStarted: boolean;
  finishing: boolean;
  disposed: boolean;
  epoch: number;
  anchorSample: number;
  anchorMediaMs: number;
  lastSampleEnd: number;
  faceWindows: Map<number, FaceWindow>;
  gate: PredictionGate;
  budget: FaceInferenceBudget;
  faceIntervalMs: number;
  lastFaceMs: number;
  faceBusy: boolean;
  faceErrorCount: number;
  frameCallback?: number;
  fallbackTimer?: ReturnType<typeof setTimeout>;
  asrQueue: AsrJob[];
  asrCurrent: AsrJob | null;
  pendingPartial?: AsrJob;
  emotionCurrent: EmotionJob | null;
  emotionPending: EmotionJob | null;
  emotionBusy: boolean;
  flushQueue: { kind: 'pause' | 'seek' | 'finish'; id?: number }[];
  seekId: number;
  seekedId: number;
  wasPlayingBeforeSeek: boolean;
  rtf: number;
  faceDurations: number[];
  audioAvailable: boolean;
  audioSignalDetected: boolean;
  backpressurePaused: boolean;
}

interface VideoFrameMetadataLike {
  mediaTime: number;
}

type VideoFrameElement = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (now: number, metadata: VideoFrameMetadataLike) => void,
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

const MAX_ASR_QUEUE = 3;

export function SynchronizedVideoTest({ settings }: { settings: Settings }) {
  const research = useLabResearch();
  const videoRef = useRef<HTMLVideoElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const generationRef = useRef(0);
  const prepareAbortRef = useRef<AbortController | null>(null);
  const graphRef = useRef<AudioGraph | null>(null);
  const objectUrlRef = useRef('');
  const recentCaptionsRef = useRef(new Map<number, string[]>());
  const [src, setSrc] = useState('');
  const [mediaReleased, setMediaReleased] = useState(false);
  const [youtube, setYoutube] = useState('');
  const [embed, setEmbed] = useState('');
  const [state, setState] = useState<
    'empty' | 'preparing' | 'ready' | 'running' | 'paused' | 'finishing' | 'done' | 'error'
  >('empty');
  const [status, setStatus] = useState('Chọn video để bắt đầu kiểm thử.');
  const [error, setError] = useState('');
  const [faceResult, setFaceResult] = useState<InferenceResult>(emptyResult());
  const [captions, setCaptions] = useState<CaptionRow[]>([]);
  const [partialCaption, setPartialCaption] = useState<{ id: string; text: string } | null>(null);
  const [emotionAvailable, setEmotionAvailable] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const [audioSignalDetected, setAudioSignalDetected] = useState(false);
  const [diagnostics, setDiagnostics] = useState({ fps: 0, pendingAsr: 0, rtf: 0, faceMs: 0 });

  const clearSampler = (runtime: Runtime) => {
    const element = runtime.video as VideoFrameElement;
    if (runtime.frameCallback !== undefined)
      element.cancelVideoFrameCallback?.(runtime.frameCallback);
    runtime.frameCallback = undefined;
    if (runtime.fallbackTimer) clearTimeout(runtime.fallbackTimer);
    runtime.fallbackTimer = undefined;
  };

  const disposeRuntime = (runtime: Runtime) => {
    if (runtime.disposed) return;
    runtime.disposed = true;
    runtime.active = false;
    runtime.isPlaying = false;
    runtime.video.pause();
    clearSampler(runtime);
    releaseAudioCapture(runtime);
    if (runtime.audioGraph) void runtime.audioGraph.context.suspend().catch(() => {});
    runtime.face.close();
    runtime.vad.terminate();
    runtime.asr.terminate();
    runtime.emotion?.terminate();
  };

  function releaseAudioCapture(runtime: Runtime) {
    const capture = runtime.capture;
    if (!capture) return;
    capture.port.onmessage = null;
    capture.port.close();
    capture.disconnect();
    runtime.silence?.disconnect();
    if (runtime.audioGraph) {
      try {
        runtime.audioGraph.source.disconnect(capture);
      } catch {
        // The graph may already have been disconnected by the browser.
      }
    }
    delete runtime.capture;
    delete runtime.silence;
  }

  const disableAudioCapture = (runtime: Runtime, message: string) => {
    if (!runtime.audioAvailable) return;
    runtime.audioAvailable = false;
    releaseAudioCapture(runtime);
    setAudioAvailable(false);
    setError(message);
    emitAudit('video-test-failed', { branch: 'speech', reason: 'unsupported-browser' });
  };

  const disposeCurrent = (clearResults = true) => {
    generationRef.current++;
    prepareAbortRef.current?.abort();
    prepareAbortRef.current = null;
    const runtime = runtimeRef.current;
    runtimeRef.current = null;
    if (runtime) disposeRuntime(runtime);
    if (clearResults) {
      setFaceResult(emptyResult());
      setCaptions([]);
      setPartialCaption(null);
      setDiagnostics({ fps: 0, pendingAsr: 0, rtf: 0, faceMs: 0 });
      recentCaptionsRef.current.clear();
    }
  };

  const updateDecision = (
    runtime: Runtime,
    segment: TranscriptSegment,
    epoch: number,
    textEvidence: ModalityEvidence[],
  ) => {
    const faceEvidence = runtime.faceWindows.get(epoch)?.evidence(segment);
    const evidence = faceEvidence ? [...textEvidence, faceEvidence] : textEvidence;
    const decision = fuse(segment, evidence, runtime.fusion);
    setCaptions((current) =>
      current.map((row) =>
        row.segment.id === segment.id ? { ...row, decision, analyzing: false } : row,
      ),
    );
    return decision;
  };

  const maybeFinish = (runtime: Runtime) => {
    if (
      !runtime.finishing ||
      runtime.flushQueue.length > 0 ||
      runtime.asrCurrent ||
      runtime.asrQueue.length > 0 ||
      runtime.emotionBusy ||
      runtime.emotionPending
    )
      return;
    if (runtimeRef.current !== runtime) return;
    emitAudit('video-test-finished', { durationMs: Math.round(runtime.video.currentTime * 1000) });
    setState('done');
    setStatus('Kiểm thử đã hoàn tất. Kết quả chỉ nằm trên thiết bị này.');
    runtimeRef.current = null;
    disposeRuntime(runtime);
    runtime.video.removeAttribute('src');
    runtime.video.load();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = '';
    setMediaReleased(true);
  };

  const processEmotion = (runtime: Runtime) => {
    const job = runtime.emotionPending;
    if (
      runtimeRef.current !== runtime ||
      runtime.disposed ||
      !job ||
      runtime.emotionBusy ||
      !runtime.emotion ||
      !runtime.emotionAvailable ||
      runtime.asrCurrent ||
      runtime.asrQueue.length
    )
      return;
    runtime.emotionPending = null;
    if (runtime.rtf > 0.8) {
      updateDecision(runtime, job.segment, job.epoch, []);
      return;
    }
    runtime.emotionBusy = true;
    runtime.emotionCurrent = job;
    runtime.emotion.postMessage({
      type: 'infer',
      id: job.segment.id,
      text: job.segment.text,
      startMs: job.segment.startMs,
      endMs: job.segment.endMs,
      quality: job.quality,
      prosody: job.prosody,
    });
  };

  const startNextAsr = (runtime: Runtime) => {
    if (runtime.disposed || runtimeRef.current !== runtime) return;
    if (runtime.asrCurrent) return;
    const partial = !runtime.finishing && runtime.rtf <= 0.8 ? runtime.pendingPartial : undefined;
    if (!runtime.asrQueue.length && !partial) {
      if (runtime.backpressurePaused && !runtime.asrCurrent && !runtime.asrQueue.length) {
        runtime.backpressurePaused = false;
        setStatus('Đã xử lý xong các câu đang chờ. Bạn có thể tiếp tục video.');
      }
      processEmotion(runtime);
      maybeFinish(runtime);
      return;
    }
    const job = runtime.asrQueue.shift() ?? partial!;
    if (job.partial) runtime.pendingPartial = undefined;
    runtime.asrCurrent = job;
    setDiagnostics((value) => ({ ...value, pendingAsr: runtime.asrQueue.length + 1 }));
    const samples = job.samples;
    runtime.asr.postMessage(
      {
        type: job.partial ? 'interim' : 'transcribe',
        id: job.id,
        samples,
        startMs: job.startMs,
        endMs: job.endMs,
        quality: job.quality,
        boundary: job.boundary,
        utteranceId: job.utteranceId,
        revision: job.revision,
      },
      [samples.buffer],
    );
  };

  const enqueueAudioChunk = (
    runtime: Runtime,
    chunk: SpeechChunk & { id?: string; revision?: number },
    partial = false,
  ) => {
    if (!runtime.audioAvailable) return;
    const job: AsrJob = {
      id: `${runtime.epoch}:${chunk.id ?? chunk.startSample}`,
      samples: chunk.samples,
      startMs:
        mapAudioSampleToMediaMs(chunk.startSample, runtime.anchorSample, runtime.anchorMediaMs) ??
        runtime.video.currentTime * 1000,
      endMs:
        mapAudioSampleToMediaMs(chunk.endSample, runtime.anchorSample, runtime.anchorMediaMs) ??
        runtime.video.currentTime * 1000,
      quality: chunk.quality,
      epoch: runtime.epoch,
      boundary: chunk.boundary,
      utteranceId: chunk.utteranceId ? `${runtime.epoch}:${chunk.utteranceId}` : undefined,
      prosody: chunk.prosody,
      partial,
      revision: chunk.revision,
    };
    if (partial) {
      runtime.pendingPartial = job;
      startNextAsr(runtime);
      return;
    }
    if (runtime.pendingPartial?.id === job.id) runtime.pendingPartial = undefined;
    runtime.asrQueue.push(job);
    if (runtime.asrQueue.length + Number(Boolean(runtime.asrCurrent)) >= MAX_ASR_QUEUE) {
      runtime.backpressurePaused = true;
      setStatus('Máy đang xử lý chậm. Video tạm dừng để hoàn tất các câu đang chờ.');
      if (!runtime.video.paused) runtime.video.pause();
    }
    startNextAsr(runtime);
  };

  const handleAsrMessage = (runtime: Runtime, event: MessageEvent) => {
    if (runtimeRef.current !== runtime || runtime.disposed) return;
    if (event.data.type === 'error') {
      runtime.asrCurrent = null;
      setError('Chưa xử lý được một đoạn phụ đề. Biểu cảm khuôn mặt vẫn tiếp tục.');
      emitAudit('video-test-failed', { branch: 'speech', reason: 'worker-failed' });
      startNextAsr(runtime);
      return;
    }
    if (
      !['result', 'partial'].includes(event.data.type) ||
      !runtime.asrCurrent ||
      event.data.segment.id !== runtime.asrCurrent.id
    )
      return;
    const job = runtime.asrCurrent;
    runtime.asrCurrent = null;
    if (job.epoch !== runtime.epoch) {
      startNextAsr(runtime);
      return;
    }
    const raw = event.data.segment as TranscriptSegment;
    runtime.rtf = runtime.load.observe(job, raw.processingMs);
    if (event.data.type === 'partial') {
      const unclear = !raw.text.trim() || isSuspiciousRecognition(raw.text);
      if (unclear) runtime.partialDisplay.reset();
      if (runtime.isPlaying && !runtime.finishing)
        setPartialCaption({
          id: job.id,
          text: unclear
            ? 'Chưa nghe rõ'
            : runtime.partialDisplay.update(job.id, job.revision ?? 0, raw.text, job.endMs).text,
        });
      startNextAsr(runtime);
      return;
    }
    setPartialCaption((value) => (value?.id === job.id ? null : value));
    runtime.partialDisplay.reset();
    if (!raw.text.trim() || isSuspiciousRecognition(raw.text)) {
      runtime.context.reset();
      setError('Chưa nghe rõ một đoạn. Kết quả này không được dùng để tổng hợp.');
      startNextAsr(runtime);
      return;
    }
    const epochCaptions = recentCaptionsRef.current.get(job.epoch) ?? [];
    const revision = reviseCaption(raw.text, epochCaptions);
    const segment: TranscriptSegment = {
      ...raw,
      text: revision.text,
      ...(revision.changed ? { rawText: revision.original, revision: revision.revision } : {}),
      startMs: job.startMs,
      endMs: job.endMs,
      boundary: job.boundary,
      utteranceId: job.utteranceId,
    };
    recentCaptionsRef.current.set(job.epoch, [...epochCaptions, segment.text].slice(-2));
    setCaptions((current) =>
      [...current, { segment, decision: null, analyzing: runtime.emotionAvailable }].slice(-20),
    );
    setDiagnostics({
      fps: diagnosticsRef.current.fps,
      pendingAsr: runtime.asrQueue.length,
      rtf: runtime.rtf,
      faceMs: diagnosticsRef.current.faceMs,
    });
    const context = runtime.context.accept(segment);
    if (runtime.emotionAvailable && context) {
      if (runtime.emotionPending)
        updateDecision(runtime, runtime.emotionPending.segment, runtime.emotionPending.epoch, []);
      runtime.emotionPending = {
        segment: context,
        epoch: job.epoch,
        quality: job.quality,
        prosody: job.prosody,
      };
      processEmotion(runtime);
    } else {
      updateDecision(runtime, segment, job.epoch, []);
    }
    startNextAsr(runtime);
  };

  const diagnosticsRef = useRef(diagnostics);
  diagnosticsRef.current = diagnostics;

  const handleVadMessage = (runtime: Runtime, event: MessageEvent) => {
    if (runtimeRef.current !== runtime || runtime.disposed) return;
    if (event.data.type === 'chunk') {
      enqueueAudioChunk(runtime, event.data);
      return;
    }
    if (event.data.type === 'interim') {
      enqueueAudioChunk(runtime, event.data, true);
      return;
    }
    if (event.data.type === 'error') {
      runtime.audioAvailable = false;
      runtime.vadAvailable = false;
      setAudioAvailable(false);
      releaseAudioCapture(runtime);
      runtime.vad.terminate();
      runtime.flushQueue = [];
      setError('Phụ đề từ video chưa hoạt động. Có thể tiếp tục kiểm tra biểu cảm khuôn mặt.');
      emitAudit('video-test-failed', { branch: 'speech', reason: 'worker-failed' });
      processEmotion(runtime);
      maybeFinish(runtime);
      return;
    }
    if (event.data.type === 'flushed') {
      const flush = runtime.flushQueue.shift();
      if (
        flush?.kind === 'seek' &&
        flush.id === runtime.seekId &&
        runtime.seekedId >= runtime.seekId
      ) {
        runtime.anchorSample = runtime.lastSampleEnd;
        runtime.anchorMediaMs = runtime.video.currentTime * 1000;
        runtime.epoch++;
        runtime.partialDisplay.reset();
        runtime.context.reset();
        runtime.load = new AsrWorkload();
        runtime.rtf = 0;
        runtime.pendingPartial = undefined;
        setPartialCaption(null);
        runtime.faceWindows.set(runtime.epoch, new FaceWindow());
        while (runtime.faceWindows.size > 4)
          runtime.faceWindows.delete(runtime.faceWindows.keys().next().value!);
        runtime.gate = new PredictionGate(settings);
        for (const key of recentCaptionsRef.current.keys()) {
          if (key < runtime.epoch - 1) recentCaptionsRef.current.delete(key);
        }
        setFaceResult(emptyResult());
        emitAudit('video-test-seeked', {
          durationMs: Math.round(runtime.video.currentTime * 1000),
        });
        if (runtime.wasPlayingBeforeSeek && !runtime.finishing) {
          void runtime.audioGraph?.context.resume().catch(() => {
            if (runtimeRef.current !== runtime || runtime.disposed) return;
            disableAudioCapture(
              runtime,
              'Chưa mở được âm thanh của video. Nhận diện khuôn mặt vẫn tiếp tục.',
            );
          });
          runtime.isPlaying = true;
          startFaceSampling(runtime);
        }
      }
      if (flush?.kind === 'finish') maybeFinish(runtime);
      if (flush?.kind === 'pause' && runtime.finishing) maybeFinish(runtime);
      maybeFinish(runtime);
    }
  };

  const requestFlush = (runtime: Runtime, kind: 'pause' | 'seek' | 'finish', id?: number) => {
    if (!runtime.vadAvailable) {
      runtime.flushQueue = [];
      maybeFinish(runtime);
      return;
    }
    runtime.flushQueue.push({ kind, id });
    try {
      runtime.vad.postMessage({ type: 'flush', reset: kind === 'seek' });
    } catch {
      runtime.vadAvailable = false;
      runtime.audioAvailable = false;
      releaseAudioCapture(runtime);
      runtime.flushQueue = [];
      setAudioAvailable(false);
      setError('Không thể hoàn tất xử lý âm thanh. Nhận diện khuôn mặt vẫn hoạt động.');
      emitAudit('video-test-failed', { branch: 'speech', reason: 'worker-failed' });
      maybeFinish(runtime);
    }
  };

  const scheduleNextFrame = (runtime: Runtime) => {
    if (!runtime.active || !runtime.isPlaying || runtime.disposed || runtimeRef.current !== runtime)
      return;
    const video = runtime.video as VideoFrameElement;
    if (video.requestVideoFrameCallback) {
      runtime.frameCallback = video.requestVideoFrameCallback((_now, metadata) => {
        runtime.frameCallback = undefined;
        void inferFrame(runtime, metadata.mediaTime * 1000).finally(() =>
          scheduleNextFrame(runtime),
        );
      });
    } else {
      runtime.fallbackTimer = setTimeout(
        () => {
          runtime.fallbackTimer = undefined;
          void inferFrame(runtime, runtime.video.currentTime * 1000).finally(() =>
            scheduleNextFrame(runtime),
          );
        },
        Math.max(100, runtime.faceIntervalMs),
      );
    }
  };

  function startFaceSampling(runtime: Runtime) {
    if (!runtime.active || !runtime.isPlaying || runtime.disposed) return;
    clearSampler(runtime);
    scheduleNextFrame(runtime);
  }

  async function inferFrame(runtime: Runtime, mediaMs: number) {
    if (
      runtime.disposed ||
      runtime.faceBusy ||
      runtime.video.seeking ||
      runtime.video.readyState < 2 ||
      mediaMs - runtime.lastFaceMs < runtime.faceIntervalMs
    )
      return;
    const epoch = runtime.epoch;
    runtime.faceBusy = true;
    runtime.lastFaceMs = mediaMs;
    const started = performance.now();
    try {
      const raw = await runtime.face.infer(runtime.video, mediaMs);
      if (runtimeRef.current !== runtime || runtime.disposed || runtime.epoch !== epoch) return;
      runtime.faceErrorCount = 0;
      const gated = runtime.gate.update(raw);
      const result = gated.result;
      setFaceResult(result);
      runtime.faceWindows.get(runtime.epoch)?.add(result);
      const elapsed = performance.now() - started;
      runtime.faceDurations = [...runtime.faceDurations, elapsed].slice(-20);
      const sorted = [...runtime.faceDurations].sort((a, b) => a - b);
      const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? elapsed;
      runtime.faceIntervalMs = runtime.budget.update(
        performance.now(),
        runtime.asrQueue.length + Number(Boolean(runtime.asrCurrent)),
        runtime.rtf,
        p95,
      );
      const nextDiagnostics = {
        fps: 1000 / Math.max(200, runtime.faceIntervalMs),
        pendingAsr: runtime.asrQueue.length + Number(Boolean(runtime.asrCurrent)),
        rtf: runtime.rtf,
        faceMs: elapsed,
      };
      diagnosticsRef.current = nextDiagnostics;
      setDiagnostics(nextDiagnostics);
    } catch {
      runtime.faceErrorCount++;
      if (runtime.faceErrorCount >= 3 && runtimeRef.current === runtime) {
        runtime.active = false;
        clearSampler(runtime);
        runtime.face.close();
        setError('Nhận diện khuôn mặt bị gián đoạn. Phụ đề vẫn có thể tiếp tục.');
        emitAudit('video-test-failed', { branch: 'face', reason: 'worker-failed' });
      }
    } finally {
      runtime.faceBusy = false;
    }
  }

  const chooseFile = (file?: File) => {
    disposeCurrent();
    setError('');
    setStatus('Chọn video để bắt đầu kiểm thử.');
    setState('empty');
    setAudioAvailable(true);
    setAudioSignalDetected(false);
    setEmotionAvailable(false);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = '';
    setSrc('');
    setMediaReleased(false);
    if (!file) return;
    if (!/\.(mp4|webm)$/i.test(file.name)) {
      setState('error');
      setError('Chọn tệp MP4 hoặc WebM. Codec còn phụ thuộc trình duyệt.');
      emitAudit('video-test-failed', { branch: 'assets', reason: 'unknown' });
      return;
    }
    objectUrlRef.current = URL.createObjectURL(file);
    setSrc(objectUrlRef.current);
    setCaptions([]);
    setFaceResult(emptyResult());
    recentCaptionsRef.current.clear();
    emitAudit('video-test-file-selected', { count: 1 });
  };

  const prepare = async () => {
    const video = videoRef.current;
    if (!video || !src || !Number.isFinite(video.duration) || video.duration <= 0) return;
    disposeCurrent();
    const generation = generationRef.current;
    const abort = new AbortController();
    prepareAbortRef.current = abort;
    setState('preparing');
    setStatus('Đang chuẩn bị AI trên thiết bị…');
    setError('');
    let face: InferenceClient | null = null;
    let vad: Worker | null = null;
    let asr: Worker | null = null;
    try {
      face = new InferenceClient(undefined, research.face !== 'product', research.face);
      await face.ready;
      if (generation !== generationRef.current) throw new DOMException('Cancelled', 'AbortError');
      asr = new Worker(
        new URL('../../infrastructure/inference/speech.worker.ts', import.meta.url),
        { type: 'module' },
      );
      asr.addEventListener('message', (event) => {
        if (event.data?.type === 'ready')
          emitAudit('asr-model-ready', {
            modelProfile: event.data.modelVersion?.startsWith('gipformer')
              ? 'gipformer1.5-int8'
              : event.data.modelVersion?.startsWith('phowhisper')
                ? 'phowhisper-tiny-q8'
                : 'whisper-tiny-q8',
          });
      });
      await makeWorkerReady(asr, { type: 'init', profile: research.asr }, abort.signal);
      if (generation !== generationRef.current) throw new DOMException('Cancelled', 'AbortError');
      vad = new Worker(new URL('../../infrastructure/inference/vad.worker.ts', import.meta.url), {
        type: 'module',
      });
      await makeWorkerReady(vad, { type: 'init', prosody: Boolean(research.tone) }, abort.signal);
      if (generation !== generationRef.current) throw new DOMException('Cancelled', 'AbortError');

      let audioGraph = graphRef.current;
      let audioReady = true;
      try {
        if (!audioGraph) {
          const context = new AudioContext();
          const source = context.createMediaElementSource(video);
          source.connect(context.destination);
          audioGraph = { context, source, workletLoaded: false };
          graphRef.current = audioGraph;
        }
        if (!audioGraph.workletLoaded) {
          await audioGraph.context.audioWorklet.addModule(captureUrl);
          audioGraph.workletLoaded = true;
        }
      } catch {
        audioReady = false;
        setAudioAvailable(false);
        setError('Trình duyệt chưa hỗ trợ lấy tiếng từ video. Có thể tiếp tục kiểm tra khuôn mặt.');
        emitAudit('video-test-failed', { branch: 'audio', reason: 'unsupported-browser' });
      }

      const runtime: Runtime = {
        context: new SpeechContext(),
        load: new AsrWorkload(),
        fusion: research.tone ? speechFusionCandidates[research.weights] : baselineFusion,
        generation,
        video,
        face,
        vad,
        asr,
        emotionAvailable: false,
        vadAvailable: true,
        audioGraph: audioGraph ?? undefined,
        active: true,
        isPlaying: false,
        hasStarted: false,
        finishing: false,
        disposed: false,
        epoch: 0,
        partialDisplay: new PartialCaptionStabilizer(),
        anchorSample: 0,
        anchorMediaMs: video.currentTime * 1000,
        lastSampleEnd: 0,
        faceWindows: new Map([[0, new FaceWindow()]]),
        gate: new PredictionGate(settings),
        budget: new FaceInferenceBudget(),
        faceIntervalMs: 200,
        lastFaceMs: -Infinity,
        faceBusy: false,
        faceErrorCount: 0,
        asrQueue: [],
        asrCurrent: null,
        emotionCurrent: null,
        emotionPending: null,
        emotionBusy: false,
        flushQueue: [],
        seekId: 0,
        seekedId: 0,
        wasPlayingBeforeSeek: false,
        rtf: 0,
        faceDurations: [],
        audioAvailable: audioReady,
        audioSignalDetected: false,
        backpressurePaused: false,
      };
      if (audioReady && audioGraph) {
        try {
          const capture = new AudioWorkletNode(audioGraph.context, 'signemo-capture');
          runtime.capture = capture;
          const silence = audioGraph.context.createGain();
          runtime.silence = silence;
          silence.gain.value = 0;
          audioGraph.source
            .connect(capture)
            .connect(silence)
            .connect(audioGraph.context.destination);
          capture.port.onmessage = (event) => {
            if (runtimeRef.current !== runtime || runtime.disposed || !runtime.isPlaying) return;
            runtime.lastSampleEnd = event.data.offset + 512;
            if (runtime.video.seeking) return;
            const samples = event.data.samples as Float32Array;
            let squareSum = 0;
            for (let index = 0; index < samples.length; index++) squareSum += samples[index] ** 2;
            if (
              !runtime.audioSignalDetected &&
              Math.sqrt(squareSum / Math.max(1, samples.length)) > 0.002
            ) {
              runtime.audioSignalDetected = true;
              setAudioSignalDetected(true);
            }
            runtime.vad.postMessage({ type: 'frame', samples, offset: event.data.offset }, [
              samples.buffer,
            ]);
          };
        } catch {
          runtime.audioAvailable = false;
          releaseAudioCapture(runtime);
          setAudioAvailable(false);
          setError(
            'Trình duyệt chưa hỗ trợ lấy tiếng từ video. Có thể tiếp tục kiểm tra khuôn mặt.',
          );
          emitAudit('video-test-failed', { branch: 'audio', reason: 'unsupported-browser' });
        }
      }
      runtime.vad.onmessage = (event) => handleVadMessage(runtime, event);
      runtime.asr.onmessage = (event) => handleAsrMessage(runtime, event);
      runtime.vad.onerror = () => {
        if (runtimeRef.current !== runtime || runtime.disposed) return;
        runtime.audioAvailable = false;
        runtime.vadAvailable = false;
        setAudioAvailable(false);
        releaseAudioCapture(runtime);
        runtime.vad.terminate();
        runtime.flushQueue = [];
        setError('Chưa xử lý được âm thanh của video. Nhận diện khuôn mặt vẫn tiếp tục.');
        emitAudit('video-test-failed', { branch: 'audio', reason: 'worker-failed' });
        processEmotion(runtime);
        maybeFinish(runtime);
      };
      runtime.asr.onerror = () => {
        if (runtimeRef.current !== runtime || runtime.disposed) return;
        runtime.audioAvailable = false;
        setAudioAvailable(false);
        releaseAudioCapture(runtime);
        runtime.asr.terminate();
        runtime.asrCurrent = null;
        runtime.asrQueue = [];
        setDiagnostics((value) => ({ ...value, pendingAsr: 0 }));
        setError('Chưa xử lý được phụ đề của video. Nhận diện khuôn mặt vẫn tiếp tục.');
        emitAudit('video-test-failed', { branch: 'speech', reason: 'worker-failed' });
        processEmotion(runtime);
        maybeFinish(runtime);
      };
      runtimeRef.current = runtime;
      // The runtime owns these resources from this point onward.
      face = null;
      vad = null;
      asr = null;

      if (generation !== generationRef.current) {
        runtimeRef.current = null;
        disposeRuntime(runtime);
        return;
      }

      setAudioAvailable(runtime.audioAvailable);
      setStatus(
        audioReady
          ? 'Đang chuẩn bị gợi ý tổng hợp…'
          : 'Sẵn sàng kiểm tra khuôn mặt; phụ đề không khả dụng.',
      );
      emitAudit('video-test-branch-ready', { branch: 'speech' });
      emitAudit('video-test-branch-ready', {
        branch: 'face',
        modelProfile: research.face.startsWith('b0-') ? 'emotieff-b0' : 'emotieff-b2-research',
      });

      const emotion = new Worker(
        new URL('../../infrastructure/inference/emotion.worker.ts', import.meta.url),
        { type: 'module' },
      );
      emotion.addEventListener('message', (event) => {
        if (event.data?.type === 'branch-warning')
          emitAudit('worker-failed', {
            branch: event.data.branch === 'voice' ? 'voice' : 'text',
            reason: 'worker-failed',
          });
        if (event.data?.type === 'ready' && event.data.voiceAvailable)
          emitAudit('video-test-branch-ready', {
            branch: 'voice',
            modelProfile: 'tone-mlp-research',
          });
      });
      try {
        await makeWorkerReady(
          emotion,
          { type: 'init', research: true, prosody: research.tone },
          abort.signal,
        );
        if (generation !== generationRef.current || runtimeRef.current !== runtime) {
          emotion.terminate();
          return;
        }
        runtime.emotion = emotion;
        runtime.emotionAvailable = true;
        emotion.onmessage = (event) => {
          if (runtimeRef.current !== runtime || runtime.disposed) return;
          if (
            event.data.type === 'result' &&
            runtime.emotionCurrent?.segment.id === event.data.id
          ) {
            const job = runtime.emotionCurrent;
            runtime.emotionCurrent = null;
            runtime.emotionBusy = false;
            if (job)
              updateDecision(
                runtime,
                job.segment,
                job.epoch,
                event.data.evidence as ModalityEvidence[],
              );
            processEmotion(runtime);
            maybeFinish(runtime);
          } else if (event.data.type === 'error') {
            const job = runtime.emotionCurrent;
            runtime.emotionCurrent = null;
            runtime.emotionBusy = false;
            runtime.emotionAvailable = false;
            runtime.emotion?.terminate();
            delete runtime.emotion;
            setEmotionAvailable(false);
            if (job) updateDecision(runtime, job.segment, job.epoch, []);
            if (runtime.emotionPending)
              updateDecision(
                runtime,
                runtime.emotionPending.segment,
                runtime.emotionPending.epoch,
                [],
              );
            runtime.emotionPending = null;
            setError('Gợi ý sắc thái tạm dừng; phụ đề và khuôn mặt vẫn hoạt động.');
            emitAudit('video-test-failed', { branch: 'emotion', reason: 'worker-failed' });
            maybeFinish(runtime);
          }
        };
        emotion.onerror = () => {
          if (runtimeRef.current !== runtime || runtime.disposed) return;
          const current = runtime.emotionCurrent;
          const pending = runtime.emotionPending;
          runtime.emotionCurrent = null;
          runtime.emotionPending = null;
          runtime.emotionBusy = false;
          runtime.emotionAvailable = false;
          runtime.emotion?.terminate();
          delete runtime.emotion;
          setEmotionAvailable(false);
          if (current) updateDecision(runtime, current.segment, current.epoch, []);
          if (pending) updateDecision(runtime, pending.segment, pending.epoch, []);
          setError('Gợi ý sắc thái tạm dừng; phụ đề và khuôn mặt vẫn hoạt động.');
          emitAudit('video-test-failed', { branch: 'emotion', reason: 'worker-failed' });
          maybeFinish(runtime);
        };
        setEmotionAvailable(true);
        emitAudit('video-test-branch-ready', { branch: 'emotion' });
      } catch {
        emotion.terminate();
        if (runtimeRef.current === runtime) {
          setEmotionAvailable(false);
          setError('Gợi ý tổng hợp chưa sẵn sàng; phụ đề và khuôn mặt vẫn hoạt động.');
          emitAudit('video-test-failed', { branch: 'emotion', reason: 'worker-failed' });
        }
      }
      if (generation === generationRef.current && runtimeRef.current === runtime) {
        setState('ready');
        setStatus('Sẵn sàng. Bắt đầu để phát video và phân tích đồng thời.');
      }
    } catch (cause) {
      const runtime = runtimeRef.current;
      if (runtime?.generation === generation) {
        runtimeRef.current = null;
        disposeRuntime(runtime);
      }
      face?.close();
      vad?.terminate();
      asr?.terminate();
      if (generation === generationRef.current) {
        setState('error');
        setError(
          cause instanceof Error && cause.name === 'AbortError'
            ? 'Đã hủy chuẩn bị video.'
            : 'Chưa chuẩn bị được AI. Kiểm tra tài nguyên rồi thử lại.',
        );
        setStatus('Chưa sẵn sàng.');
        emitAudit('video-test-failed', { branch: 'assets', reason: 'worker-failed' });
      }
    } finally {
      if (generation === generationRef.current) prepareAbortRef.current = null;
    }
  };

  const start = async () => {
    const runtime = runtimeRef.current;
    if (!runtime || runtime.disposed || runtime.finishing) return;
    runtime.anchorSample = runtime.lastSampleEnd;
    runtime.anchorMediaMs = runtime.video.currentTime * 1000;
    runtime.video.playbackRate = 1;
    runtime.isPlaying = true;
    runtime.active = true;
    const resume = runtime.audioGraph
      ? runtime.audioGraph.context.resume().then(
          () => true,
          () => false,
        )
      : Promise.resolve(true);
    const play = runtime.video.play();
    try {
      await play;
      const audioResumed = await resume;
      if (!audioResumed)
        disableAudioCapture(
          runtime,
          'Chưa mở được âm thanh của video. Nhận diện khuôn mặt vẫn tiếp tục.',
        );
      if (runtimeRef.current !== runtime || runtime.disposed || runtime.finishing) return;
      setState('running');
      setStatus('Đang phân tích video trên thiết bị.');
      runtime.hasStarted = true;
      emitAudit('video-test-started', { durationMs: Math.round(runtime.video.duration * 1000) });
      startFaceSampling(runtime);
    } catch {
      runtime.isPlaying = false;
      clearSampler(runtime);
      runtime.video.pause();
      void runtime.audioGraph?.context.suspend().catch(() => {});
      setState('ready');
      setError('Không phát được video. Bấm thử lại hoặc chọn tệp khác.');
      emitAudit('video-test-failed', { branch: 'assets', reason: 'unsupported-browser' });
    }
  };

  const finish = (runtime = runtimeRef.current) => {
    if (!runtime || runtime.disposed || runtime.finishing) return;
    runtime.finishing = true;
    runtime.isPlaying = false;
    clearSampler(runtime);
    runtime.video.pause();
    void runtime.audioGraph?.context.suspend().catch(() => {});
    setState('finishing');
    setStatus('Đang hoàn tất câu cuối…');
    requestFlush(runtime, 'finish');
  };

  const embedYoutube = () => {
    const id = youtubeId(youtube);
    if (!id) {
      setError('Link YouTube không hợp lệ.');
      emitAudit('video-test-failed', { branch: 'assets', reason: 'unknown' });
      return;
    }
    setEmbed(id);
    setError('');
    emitAudit('video-test-reference-opened');
  };

  useEffect(() => {
    return () => {
      disposeCurrent(false);
      const graph = graphRef.current;
      graphRef.current = null;
      if (graph) void graph.context.close().catch(() => {});
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
    // This cleanup must run only when this panel unmounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentFace = faceResult.label
    ? expressionUI[faceResult.label].description
    : 'Chưa xác định';
  const latestCaption = captions.at(-1);
  const currentFusion = latestCaption?.decision;

  return (
    <section
      className="card settings-card synchronized-video-test"
      aria-labelledby="sync-video-title"
    >
      <div className="lab-heading-row">
        <div>
          <h2 id="sync-video-title">Kiểm thử video đồng bộ</h2>
          <p className="fine-note">
            Chọn video local để AI xử lý trên thiết bị. YouTube chỉ dùng tham khảo.
          </p>
        </div>
        {state === 'running' && <span className="status-pill">Đang phân tích</span>}
      </div>

      <label className="field">
        Chọn video MP4/WebM
        <input
          type="file"
          accept="video/mp4,video/webm,.mp4,.webm"
          onChange={(event) => {
            chooseFile(event.target.files?.[0]);
            event.currentTarget.value = '';
          }}
        />
      </label>
      <ResearchOptions
        research={research}
        disabled={['preparing', 'ready', 'running', 'paused', 'finishing'].includes(state)}
      />

      <video
        className={`lab-video synchronized-video-player${src && !mediaReleased ? '' : ' sync-video-hidden'}`}
        ref={videoRef}
        src={src && !mediaReleased ? src : undefined}
        hidden={!src || mediaReleased}
        playsInline
        controls={state === 'running' || state === 'paused'}
        onRateChange={() => {
          const video = videoRef.current;
          if (video && video.playbackRate !== 1) video.playbackRate = 1;
        }}
        onLoadedMetadata={() => void prepare()}
        onError={() => {
          disposeCurrent(false);
          if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = '';
          setSrc('');
          setMediaReleased(true);
          setState('error');
          setError('Không đọc được video. Thử MP4 H.264 hoặc WebM mà trình duyệt hỗ trợ.');
          emitAudit('video-test-failed', { branch: 'assets', reason: 'unsupported-browser' });
        }}
        onPlay={() => {
          const runtime = runtimeRef.current;
          if (!runtime || runtime.disposed || runtime.finishing) return;
          if (!runtime.isPlaying) {
            runtime.isPlaying = true;
            runtime.backpressurePaused = false;
            if (runtime.hasStarted) emitAudit('video-test-resumed');
            setState('running');
            setStatus('Đang phân tích video trên thiết bị.');
            void runtime.audioGraph?.context.resume().catch(() => {
              if (runtimeRef.current !== runtime || runtime.disposed) return;
              disableAudioCapture(
                runtime,
                'Chưa mở được âm thanh của video. Nhận diện khuôn mặt vẫn tiếp tục.',
              );
            });
            startFaceSampling(runtime);
          }
        }}
        onPause={() => {
          const runtime = runtimeRef.current;
          if (!runtime || runtime.disposed || runtime.finishing || runtime.video.ended) return;
          runtime.isPlaying = false;
          clearSampler(runtime);
          void runtime.audioGraph?.context.suspend().catch(() => {});
          setState('paused');
          setStatus(
            runtime.backpressurePaused
              ? 'Máy đang xử lý chậm. Video tạm dừng để hoàn tất các câu đang chờ.'
              : 'Video đang tạm dừng.',
          );
          emitAudit('video-test-paused', {
            durationMs: Math.round(runtime.video.currentTime * 1000),
          });
          requestFlush(runtime, 'pause');
        }}
        onSeeking={() => {
          const runtime = runtimeRef.current;
          if (!runtime || runtime.disposed || runtime.finishing) return;
          runtime.wasPlayingBeforeSeek = !runtime.video.paused;
          runtime.seekId++;
          runtime.asrQueue = [];
          runtime.pendingPartial = undefined;
          runtime.emotionPending = null;
          setPartialCaption(null);
          clearSampler(runtime);
          void runtime.audioGraph?.context.suspend().catch(() => {});
          requestFlush(runtime, 'seek', runtime.seekId);
        }}
        onSeeked={() => {
          const runtime = runtimeRef.current;
          if (!runtime || runtime.disposed || runtime.finishing) return;
          runtime.seekedId = runtime.seekId;
          if (
            !runtime.flushQueue.some(
              (entry) => entry.kind === 'seek' && entry.id === runtime.seekId,
            )
          ) {
            runtime.anchorSample = runtime.lastSampleEnd;
            runtime.anchorMediaMs = runtime.video.currentTime * 1000;
            runtime.epoch++;
            runtime.partialDisplay.reset();
            runtime.context.reset();
            runtime.load = new AsrWorkload();
            runtime.rtf = 0;
            runtime.pendingPartial = undefined;
            setPartialCaption(null);
            runtime.faceWindows.set(runtime.epoch, new FaceWindow());
            while (runtime.faceWindows.size > 4)
              runtime.faceWindows.delete(runtime.faceWindows.keys().next().value!);
            runtime.gate = new PredictionGate(settings);
            for (const key of recentCaptionsRef.current.keys()) {
              if (key < runtime.epoch - 1) recentCaptionsRef.current.delete(key);
            }
            setFaceResult(emptyResult());
            emitAudit('video-test-seeked', {
              durationMs: Math.round(runtime.video.currentTime * 1000),
            });
            if (runtime.wasPlayingBeforeSeek) {
              void runtime.audioGraph?.context.resume().catch(() => {
                if (runtimeRef.current !== runtime || runtime.disposed) return;
                disableAudioCapture(
                  runtime,
                  'Chưa mở được âm thanh của video. Nhận diện khuôn mặt vẫn tiếp tục.',
                );
              });
              runtime.isPlaying = true;
              startFaceSampling(runtime);
            }
          }
        }}
        onEnded={() => {
          const runtime = runtimeRef.current;
          if (runtime && !runtime.audioSignalDetected && runtime.audioAvailable) {
            setAudioAvailable(false);
            setError(
              'Chưa phát hiện tiếng đủ rõ trong video. Biểu cảm khuôn mặt vẫn được kiểm tra.',
            );
            emitAudit('video-test-failed', { branch: 'audio', reason: 'unknown' });
          }
          finish(runtime);
        }}
      />

      <div className="lab-actions">
        {(state === 'empty' || state === 'preparing' || state === 'error') && (
          <span role="status">
            {state === 'preparing' ? 'Đang chuẩn bị phụ đề, khuôn mặt và gợi ý…' : status}
          </span>
        )}
        {state === 'ready' && (
          <button className="button primary" onClick={() => void start()}>
            Bắt đầu kiểm thử
          </button>
        )}
        {(state === 'running' || state === 'paused' || state === 'finishing') && (
          <button
            className="button secondary"
            disabled={state === 'finishing'}
            onClick={() => finish()}
          >
            Kết thúc
          </button>
        )}
        {(state === 'paused' || state === 'done') && <span role="status">{status}</span>}
      </div>

      {error && (
        <p className="notice warning" role="status">
          {error}
        </p>
      )}

      {src && (
        <div className="sync-results-grid">
          <section className="sync-caption-panel" aria-labelledby="sync-caption-title">
            <h3 id="sync-caption-title">Phụ đề tiếng Việt</h3>
            {partialCaption && (
              <p className="provisional-caption">
                {partialCaption.text} <small>· Đang nhận dạng…</small>
              </p>
            )}
            {captions.length ? (
              <ol className="sync-caption-list" aria-live="polite">
                {captions.slice(-5).map((row) => (
                  <li key={row.segment.id}>
                    <div className="sync-caption-line">
                      <time>{(row.segment.startMs / 1000).toFixed(1)}s</time>
                      <span>{row.segment.text || 'Không nhận được lời nói rõ ràng.'}</span>
                    </div>
                    <small className="sync-caption-decision">
                      {row.analyzing
                        ? 'Đang đối chiếu biểu cảm và câu nói'
                        : row.decision?.label
                          ? `Gợi ý: ${expressionUI[row.decision.label].description}`
                          : 'Chưa đủ tín hiệu để kết luận'}
                    </small>
                    {row.segment.rawText && (
                      <details className="sync-caption-original">
                        <summary>Xem bản nhận dạng gốc</summary>
                        <p>{row.segment.rawText}</p>
                      </details>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="fine-note">Phụ đề sẽ xuất hiện khi video có lời nói.</p>
            )}
          </section>
          <section className="sync-summary-panel" aria-label="Kết quả nhận diện">
            <div>
              <span className="eyebrow">BIỂU CẢM KHUÔN MẶT</span>
              <strong>{currentFace}</strong>
              <small>{resultExplanation(faceResult)}</small>
            </div>
            <div>
              <span className="eyebrow">GỢI Ý TỔNG HỢP · THỬ NGHIỆM</span>
              <strong>
                {latestCaption?.analyzing
                  ? 'Đang đối chiếu câu vừa nói'
                  : currentFusion?.label
                    ? expressionUI[currentFusion.label].description
                    : 'Chưa xác định'}
              </strong>
              <small>
                {latestCaption?.segment.text ? `Câu: “${latestCaption.segment.text}” · ` : ''}
                {currentFusion?.reason === 'conflict'
                  ? 'Hai nguồn chưa đồng thuận.'
                  : currentFusion?.reason === 'agreement'
                    ? 'Gợi ý dựa trên câu vừa nói và biểu cảm trong cùng đoạn.'
                    : 'Cần phụ đề và biểu cảm đủ rõ trong cùng đoạn.'}
              </small>
            </div>
          </section>
        </div>
      )}

      {src && (
        <details className="sync-diagnostics">
          <summary>Chi tiết xử lý</summary>
          <p>
            {!audioAvailable
              ? 'Phụ đề không khả dụng trong trình duyệt này.'
              : audioSignalDetected
                ? 'Đã phát hiện tín hiệu âm thanh; xử lý cục bộ.'
                : 'Chưa phát hiện tiếng rõ; hãy kiểm tra âm lượng của video.'}{' '}
            {emotionAvailable ? 'Gợi ý văn bản đã sẵn sàng.' : 'Gợi ý sắc thái chưa sẵn sàng.'}
          </p>
          <p>
            FPS mặt {diagnostics.fps.toFixed(1)} · ASR đang chờ {diagnostics.pendingAsr} · RTF{' '}
            {diagnostics.rtf.toFixed(2)} · mặt {diagnostics.faceMs.toFixed(0)} ms
          </p>
          <Diagnostics result={faceResult} />
        </details>
      )}

      <details className="sync-youtube-reference">
        <summary>Video YouTube tham khảo (tùy chọn)</summary>
        <label className="field">
          Link YouTube HTTPS
          <input type="url" value={youtube} onChange={(event) => setYoutube(event.target.value)} />
        </label>
        <div className="lab-actions">
          <button className="button secondary" onClick={embedYoutube}>
            Mở tham khảo
          </button>
          {embed && (
            <button className="text-button" onClick={() => setEmbed('')}>
              Đóng
            </button>
          )}
        </div>
        {embed && (
          <iframe
            className="youtube-reference"
            title="YouTube tham khảo — không phân tích AI"
            src={`https://www.youtube-nocookie.com/embed/${embed}`}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="encrypted-media; picture-in-picture"
            allowFullScreen
            onError={() => {
              setError('Không mở được video tham khảo. Video local vẫn dùng được.');
              emitAudit('video-test-failed', { branch: 'assets', reason: 'offline' });
            }}
          />
        )}
      </details>

      {currentFusion?.label && (
        <p className="fine-note">
          Biểu cảm là gợi ý quan sát, không khẳng định cảm xúc hay ý định của người trong video.
        </p>
      )}
    </section>
  );
}
