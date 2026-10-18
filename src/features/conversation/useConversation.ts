import { useCallback, useEffect, useRef, useState } from 'react';
import speechWorkerUrl from '../../infrastructure/inference/speech.worker.ts?worker&url';
import moonshineSpeechWorkerUrl from '../../infrastructure/inference/speech-moonshine.worker.ts?worker&url';
import {
  fuse,
  type ConversationRecord,
  type FusionDecision,
  type ModalityEvidence,
  type ProvisionalCaption,
  type TranscriptSegment,
} from '../../domain/conversation';
import type { SpeechAudioQuality, SpeechChunk } from '../../domain/audio';
import type { InferenceResult } from '../../shared/contracts';
import { MicrophoneCapture } from '../../infrastructure/media/microphone';
import { disposeSpeechWorker } from '../../infrastructure/inference/disposeSpeechWorker';
import type { ConversationVault } from '../../infrastructure/storage/vault';
import { ConversationPersistence } from '../../infrastructure/storage/conversationPersistence';
import { FaceWindow } from './session';
import { makeWorkerReady } from '../../infrastructure/inference/workerReady';
import { emitAudit } from '../../infrastructure/audit/log';
import { isSuspiciousRecognition, reviseCaption } from '../../domain/captionRevision';
import { AsrWorkload, type AsrProfileId } from '../../domain/asr';
import { ToneSession } from '../../infrastructure/inference/toneSession';
import { toneFusion } from '../../domain/conversation';
import { SpeechContext } from '../../domain/speechContext';
import { emitPipelineMetric } from '../../infrastructure/diagnostics/pipelineTelemetry';
import { PartialCaptionStabilizer } from '../../domain/partialCaption';
import {
  modelInitializationCode,
  type ModelInitializationCode,
} from '../../domain/modelInitialization';

interface Task {
  queuedAtMs?: number;
  id: string;
  samples: Float32Array;
  startMs: number;
  endMs: number;
  quality: SpeechAudioQuality;
  revision?: number;
  boundary?: TranscriptSegment['boundary'];
  utteranceId?: string;
}
interface EmotionJob {
  audio: Task;
  /** A hard cut is usable for tone, not necessarily complete text semantics. */
  textReady?: boolean;
  segment: TranscriptSegment;
  quality: SpeechAudioQuality;
}
interface ActiveSession {
  id: number;
  abort: AbortController;
  microphone: MicrophoneCapture;
  audioContext?: AudioContext;
  workers: Worker[];
  vad?: Worker;
  asr?: Worker;
  emotion?: Worker;
  emotionRequested: boolean;
  emotionInitializing?: boolean;
  enableContext?: () => void;
  tone?: ToneSession;
  toneResult?: Promise<ModalityEvidence | undefined>;
  startMs: number;
  queue: Task[];
  current?: Task;
  interimCurrent?: Task;
  pendingInterim?: Task;
  emotionBusy: boolean;
  emotionTask?: EmotionJob;
  pendingEmotion?: EmotionJob;
  faces: FaceWindow;
  record: ConversationRecord;
  timer?: ReturnType<typeof setTimeout>;
  finishTimer?: ReturnType<typeof setTimeout>;
  emotionTimer?: ReturnType<typeof setTimeout>;
  flushing: boolean;
  flushed: boolean;
  finishResolve?: () => void;
  persist: boolean;
  rtf: number;
  vaultSaveLogged: boolean;
  load: AsrWorkload;
  context: SpeechContext;
  asrProfile: AsrProfileId;
  lastPerformanceAuditAt: number;
}
interface PreparedCore {
  asr: Worker;
  vad: Worker;
  profile: AsrProfileId;
}
export function useConversation(
  vault: ConversationVault,
  sharedPersistence?: ConversationPersistence,
) {
  const [storage] = useState(() => sharedPersistence ?? new ConversationPersistence(vault));
  const preparedTone = useRef<ToneSession | null>(null);
  const toneAbort = useRef<AbortController | null>(null);
  const [toneState, setToneState] = useState<'off' | 'preparing' | 'ready' | 'error'>('off');
  const [toneCached, setToneCached] = useState(true);
  const disableTone = useCallback(() => {
    toneAbort.current?.abort();
    toneAbort.current = null;
    preparedTone.current?.dispose();
    preparedTone.current = null;
    setToneState('off');
  }, []);
  const prepareTone = useCallback(async () => {
    disableTone();
    const abort = new AbortController();
    toneAbort.current = abort;
    const tone = new ToneSession();
    preparedTone.current = tone;
    setToneState('preparing');
    setToneCached(true);
    emitAudit('tone-preparing', {
      branch: 'voice',
      modelProfile: 'emotion2vec-base-fp32-gpu-research',
    });
    try {
      await tone.prepare(abort.signal);
      if (abort.signal.aborted) return false;
      setToneState('ready');
      setToneCached(tone.cacheAvailable !== false);
      if (tone.cacheAvailable === false)
        emitAudit('tone-cache-unavailable', { branch: 'storage', reason: 'storage' });
      emitAudit('tone-ready', {
        branch: 'voice',
        modelProfile: 'emotion2vec-base-fp32-gpu-research',
      });
      return true;
    } catch {
      tone.dispose();
      if (!abort.signal.aborted) {
        preparedTone.current = null;
        setToneState('error');
        emitAudit('worker-failed', { branch: 'voice', reason: 'worker-failed' });
      }
      return false;
    }
  }, [disableTone]);
  const active = useRef<ActiveSession | null>(null);
  const generation = useRef(0);
  const [state, setState] = useState<'idle' | 'loading' | 'running' | 'finishing'>('idle');
  const [status, setStatus] = useState('Camera và micro chỉ mở khi bạn bắt đầu.');
  const [error, setError] = useState('');
  const clearError = useCallback(() => setError(''), []);
  const [record, setRecord] = useState<ConversationRecord | null>(null);
  const [provisional, setProvisional] = useState<ProvisionalCaption | null>(null);
  const [evidence, setEvidence] = useState<ModalityEvidence[]>([]);
  const [workload, setWorkload] = useState<{
    pendingAsr: number;
    rtf: number;
    oldestFinalWaitMs?: number;
  }>({ pendingAsr: 0, rtf: 0 });
  useEffect(() => {
    if (state !== 'running') return;
    let pressuredSince: number | null = null;
    let healthySince: number | null = null;
    let partialLevel = 0;
    const timer = setInterval(() => {
      const session = active.current;
      if (!session) return;
      const now = performance.now();
      const rtf = session.load.recentRtf(now);
      const oldestFinalWaitMs = session.queue.length
        ? Math.max(0, now - (session.queue[0].queuedAtMs ?? now))
        : 0;
      setWorkload(session.load.snapshot(session.queue, now));
      emitPipelineMetric({
        stage: 'workload',
        durationMs: oldestFinalWaitMs,
        queue: session.queue.length,
        rtf,
      });
      if (rtf > 0.6 || oldestFinalWaitMs > 250) {
        healthySince = null;
        pressuredSince ??= now;
        if (now - pressuredSince >= 2000) {
          partialLevel = Math.min(2, partialLevel + 1);
          pressuredSince = now;
        }
      } else {
        pressuredSince = null;
        healthySince ??= now;
        if (now - healthySince >= 10000) {
          partialLevel = Math.max(0, partialLevel - 1);
          healthySince = now;
        }
      }
      session.vad?.postMessage({
        type: 'partial-budget',
        samples: [8192, 12288, 16384][partialLevel],
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [state]);
  const preparedCore = useRef<PreparedCore | null>(null);
  const preparingCore = useRef<Promise<boolean> | null>(null);
  const preparingProfile = useRef<AsrProfileId | null>(null);
  const preparingAbort = useRef<AbortController | null>(null);
  const preparationGeneration = useRef(0);
  const [preparedProfile, setPreparedProfile] = useState<AsrProfileId | null>(null);
  const preparationFailure = useRef<ModelInitializationCode>('worker');
  const disposePrepared = useCallback(() => {
    preparationGeneration.current++;
    preparingAbort.current?.abort();
    preparingAbort.current = null;
    preparingCore.current = null;
    if (preparedCore.current)
      void disposeSpeechWorker(preparedCore.current.asr, preparedCore.current.profile);
    preparedCore.current?.vad.terminate();
    disableTone();
    preparedCore.current = null;
    preparingProfile.current = null;
    setPreparedProfile(null);
  }, [disableTone]);
  const prepare = useCallback(
    (profile: AsrProfileId = 'product') => {
      if (preparedCore.current?.profile === profile) return Promise.resolve(true);
      if (preparingProfile.current === profile && preparingCore.current)
        return preparingCore.current;
      disposePrepared();
      const asr = new Worker(
        profile === 'moonshine-streaming-vi-research' ? moonshineSpeechWorkerUrl : speechWorkerUrl,
        { type: 'module' },
      );
      const vad = new Worker(
        new URL('../../infrastructure/inference/vad.worker.ts', import.meta.url),
        { type: 'module' },
      );
      const abort = new AbortController();
      const request = ++preparationGeneration.current;
      preparingAbort.current = abort;
      const task = (async () => {
        const onSpeechModelReady = (event: MessageEvent) => {
          if (event.data?.type !== 'ready') return;
          emitAudit('asr-model-ready', {
            branch: 'speech',
            modelProfile:
              profile === 'moonshine-streaming-vi-research'
                ? 'moonshine-streaming-tiny-vi-research'
                : profile === 'gipformer-research'
                  ? 'gipformer1.5-int8'
                  : event.data.fallback
                    ? 'whisper-tiny-q8'
                    : 'phowhisper-tiny-q8',
          });
        };
        asr.addEventListener('message', onSpeechModelReady);
        try {
          await makeWorkerReady(asr, { type: 'init', profile }, abort.signal);
          asr.removeEventListener('message', onSpeechModelReady);
          await makeWorkerReady(
            vad,
            {
              type: 'init',
              earlyPartials: profile === 'gipformer-research',
              streaming: profile === 'moonshine-streaming-vi-research',
              fastEndpointing: true,
            },
            abort.signal,
          );
          if (request !== preparationGeneration.current || abort.signal.aborted) {
            void disposeSpeechWorker(asr, profile);
            vad.terminate();
            return false;
          }
          preparedCore.current = { asr, vad, profile };
          preparingProfile.current = null;
          setPreparedProfile(profile);
          return true;
        } catch (error: unknown) {
          preparationFailure.current = modelInitializationCode(error);
          asr.removeEventListener('message', onSpeechModelReady);
          void disposeSpeechWorker(asr, profile);
          vad.terminate();
          if (request === preparationGeneration.current && !abort.signal.aborted)
            emitAudit('ai-preparation-failed', { branch: 'speech', reason: 'worker-failed' });
          return false;
        } finally {
          if (request === preparationGeneration.current) {
            preparingAbort.current = null;
            preparingCore.current = null;
            preparingProfile.current = null;
          }
        }
      })();
      preparingProfile.current = profile;
      preparingCore.current = task;
      return task;
    },
    [disposePrepared],
  );
  const cancel = useCallback(() => {
    generation.current++;
    const session = active.current;
    active.current = null;
    if (session) {
      session.abort.abort();
      session.tone?.dispose();
      setToneState('off');
      session.microphone.stop();
      if (session.audioContext?.state !== 'closed')
        void session.audioContext?.close().catch(() => {});
      session.workers.forEach((w) => {
        if (w === session.asr) void disposeSpeechWorker(w, session.asrProfile);
        else w.terminate();
      });
      clearTimeout(session.timer);
      clearTimeout(session.finishTimer);
      clearTimeout(session.emotionTimer);
      session.finishResolve?.();
    }
    setState('idle');
    setWorkload({ pendingAsr: 0, rtf: 0 });
    setProvisional(null);
  }, []);
  const save = useCallback(
    (session: ActiveSession) => {
      setRecord({
        ...session.record,
        segments: [...session.record.segments],
        decisions: [...session.record.decisions],
      });
      if (session.persist) storage.offer(session.record);
    },
    [storage],
  );
  const start = useCallback(
    async (options: {
      emotion: boolean;
      tone?: boolean;
      persist: boolean;
      asrProfile?: AsrProfileId;
      microphoneStream?: MediaStream;
      audioContext?: AudioContext;
    }) => {
      if (storage.unsaved) {
        setError('Còn hội thoại chưa lưu. Mở khóa và lưu lại trước khi bắt đầu phiên mới.');
        return false;
      }
      const profile = options.asrProfile ?? 'product';
      if (preparedCore.current?.profile !== profile) {
        setError('Model phụ đề chưa sẵn sàng. Hãy chờ chuẩn bị xong rồi thử lại.');
        setStatus('Đang chuẩn bị model phụ đề trên thiết bị…');
        return false;
      }
      if (options.tone && !preparedTone.current) {
        setError('Tone chưa sẵn sàng. Hãy chuẩn bị hoặc tắt tone trước khi bắt đầu.');
        return false;
      }
      cancel();
      setError('');
      setEvidence([]);
      setProvisional(null);
      setState('loading');
      setStatus('Đang chuẩn bị phụ đề trên thiết bị…');
      setWorkload({ pendingAsr: 0, rtf: 0 });
      const session: ActiveSession = {
        id: ++generation.current,
        abort: new AbortController(),
        microphone: new MicrophoneCapture(),
        audioContext: options.audioContext,
        workers: [],
        emotionRequested: options.emotion || Boolean(options.tone),
        tone: options.tone ? (preparedTone.current ?? undefined) : undefined,
        startMs: 0,
        queue: [],
        pendingInterim: undefined,
        emotionBusy: false,
        pendingEmotion: undefined,
        faces: new FaceWindow(),
        record: {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          segments: [],
          decisions: [],
        },
        flushing: false,
        flushed: false,
        persist: options.persist,
        rtf: 0,
        vaultSaveLogged: false,
        load: new AsrWorkload(),
        context: new SpeechContext(),
        asrProfile: profile,
        lastPerformanceAuditAt: 0,
      };
      if (options.tone) {
        preparedTone.current = null;
        setToneState('ready');
      }
      active.current = session;
      storage.begin(session.record, options.persist);
      setRecord(session.record);
      const current = () => active.current === session;
      const partialUtterances = new Set<string>();
      const partialDisplay = new PartialCaptionStabilizer();
      let textStartedAt = 0;
      let previousAudioStartMs: number | undefined;
      const fail = (message: string) => {
        if (!current()) return false;
        setError(message);
        cancel();
      };
      const finishIfDone = () => {
        if (
          session.flushing &&
          session.flushed &&
          !session.current &&
          !session.interimCurrent &&
          !session.queue.length &&
          !session.emotionBusy &&
          !session.pendingEmotion
        ) {
          save(session);
          setStatus('Đã kết thúc phiên. Camera và micro đã tắt.');
          cancel();
        }
      };
      const decide = (segment: TranscriptSegment, items: ModalityEvidence[]) => {
        if (!current()) return false;
        const face = session.faces.evidence(segment);
        const combined = face ? [...items, face] : items;
        const decision = fuse(segment, combined, session.tone ? toneFusion : undefined);
        emitPipelineMetric({
          stage: 'fusion',
          durationMs: Math.max(0, performance.now() - segment.endMs),
          usable: decision.reason === 'agreement',
        });
        const latest = session.record.segments.at(-1)?.id === segment.id;
        if (latest) setEvidence(combined);
        session.record.decisions = session.record.decisions.filter(
          (item) => item.segmentId !== segment.id,
        );
        session.record.decisions.push(decision);
        save(session);
      };
      const completeEmotion = (items: ModalityEvidence[]) => {
        const job = session.emotionTask;
        if (!job) return;
        const complete = (voice?: ModalityEvidence) => {
          if (!current() || session.emotionTask !== job) return;
          decide(job.segment, voice ? [...items, { ...voice, segmentId: job.segment.id }] : items);
          session.emotionTask = undefined;
          session.toneResult = undefined;
          session.emotionBusy = false;
          processEmotion();
          finishIfDone();
        };
        if (session.toneResult) void session.toneResult.then(complete);
        else complete();
      };
      const processEmotion = () => {
        const job = session.pendingEmotion;
        const worker = session.emotion;
        if (
          !current() ||
          (!worker && !session.tone) ||
          session.emotionBusy ||
          session.current ||
          session.interimCurrent ||
          session.queue.length ||
          !job
        )
          return;
        session.pendingEmotion = undefined;
        // Late context can still explain an older caption; the rhythm gate rejects stale cues.
        if (session.queue.length || performance.now() - job.segment.endMs > 30_000) {
          decide(job.segment, []);
          finishIfDone();
          return;
        }
        session.emotionBusy = true;
        session.emotionTask = job;
        const toneStarted = performance.now();
        session.toneResult = session.tone
          ?.infer(job.audio.samples, job.audio.startMs, job.audio.endMs, job.quality)
          .then((voice) => {
            if (current() && Date.now() - session.lastPerformanceAuditAt >= 10_000) {
              session.lastPerformanceAuditAt = Date.now();
              emitAudit('tone-performance', {
                branch: 'voice',
                modelProfile: 'emotion2vec-base-fp32-gpu-research',
                durationMs: performance.now() - toneStarted,
              });
            }
            return voice;
          })
          .catch(() => {
            if (current()) emitAudit('worker-failed', { branch: 'voice', reason: 'worker-failed' });
            return undefined;
          });
        if (
          !worker ||
          job.textReady === false ||
          !session.load.canRunContext(session.queue.length, performance.now())
        ) {
          void completeEmotion([]);
          return;
        }
        clearTimeout(session.emotionTimer);
        session.emotionTimer = setTimeout(() => worker.dispatchEvent(new Event('error')), 10_000);
        textStartedAt = performance.now();
        worker.postMessage({
          type: 'infer',
          id: job.segment.id,
          text: job.segment.text,
          startMs: job.segment.startMs,
          endMs: job.segment.endMs,
          quality: job.quality,
        });
      };
      const enqueueEmotion = (job: EmotionJob) => {
        if (!session.emotionRequested) {
          decide(job.segment, []);
          return;
        }
        if (session.pendingEmotion && !session.tone) decide(session.pendingEmotion.segment, []);
        session.pendingEmotion = job;
      };
      const processInterim = () => {
        if (
          !current() ||
          session.flushing ||
          session.current ||
          session.queue.length ||
          session.interimCurrent ||
          session.load.recentRtf(performance.now()) > 1 ||
          !session.asr
        )
          return;
        const task = session.pendingInterim;
        if (!task) return;
        session.pendingInterim = undefined;
        session.interimCurrent = task;
        const samples = task.samples.slice();
        session.asr.postMessage({ type: 'interim', ...task, samples }, [samples.buffer]);
        clearTimeout(session.timer);
        session.timer = setTimeout(() => {
          emitAudit('worker-failed', { branch: 'speech', reason: 'timeout' });
          fail('Phụ đề tạm xử lý quá lâu. Hãy kết thúc phiên và thử lại với đoạn nói ngắn hơn.');
        }, 60_000);
      };
      const next = () => {
        if (!current() || session.current || session.interimCurrent || !session.asr) return;
        const task = session.queue.shift();
        if (!task) {
          processInterim();
          finishIfDone();
          return;
        }
        session.current = task;
        emitPipelineMetric({
          stage: 'final-queue-wait',
          durationMs: Math.max(0, performance.now() - (task.queuedAtMs ?? performance.now())),
        });
        setWorkload(session.load.snapshot(session.queue, performance.now()));
        setStatus('Đang chuyển lời nói thành văn bản…');
        const samples = task.samples.slice();
        session.asr.postMessage({ type: 'transcribe', ...task, samples }, [samples.buffer]);
        clearTimeout(session.timer);
        session.timer = setTimeout(() => {
          emitAudit('worker-failed', { branch: 'speech', reason: 'timeout' });
          fail(
            'Phụ đề xử lý quá lâu. Đã dừng thu để tránh mất lời nói. Các câu hoàn tất vẫn còn trên màn hình.',
          );
        }, 60_000);
      };
      const recordPerformance = (task: Task, processingMs: number, partial = false) => {
        session.rtf = session.load.observe(task, processingMs, performance.now());
        emitPipelineMetric({
          stage: partial ? 'asr-partial' : 'asr-final',
          durationMs: processingMs,
          queue: session.queue.length,
          rtf: session.rtf,
        });
        setWorkload(session.load.snapshot(session.queue, performance.now()));
        if (Date.now() - session.lastPerformanceAuditAt >= 10_000) {
          session.lastPerformanceAuditAt = Date.now();
          emitAudit('asr-performance', {
            branch: 'speech',
            modelProfile:
              session.asrProfile === 'gipformer-research'
                ? 'gipformer1.5-int8'
                : session.asrProfile === 'moonshine-streaming-vi-research'
                  ? 'moonshine-streaming-tiny-vi-research'
                  : 'phowhisper-tiny-q8',
            durationMs: processingMs,
            rtf: session.rtf,
            count: session.queue.length,
          });
        }
      };
      const recordDelivery = (task: Task, partial: boolean) => {
        const utterance = task.utteranceId ?? task.id;
        if (!partial || !partialUtterances.has(utterance)) {
          emitPipelineMetric({
            stage: partial ? 'partial-delivery' : 'final-delivery',
            durationMs: Math.max(0, performance.now() - (partial ? task.startMs : task.endMs)),
          });
          if (partial) {
            partialUtterances.add(utterance);
            if (partialUtterances.size > 500)
              partialUtterances.delete(partialUtterances.values().next().value!);
          }
        }
      };
      try {
        const warmed = preparedCore.current;
        preparedCore.current = null;
        setPreparedProfile(null);
        if (!warmed || warmed.profile !== profile) throw new Error('Prepared ASR profile mismatch');
        const asr = warmed.asr;
        const vad = warmed.vad;
        session.workers.push(asr, vad);
        session.asr = asr;
        session.vad = vad;
        if (!current()) return;
        const initializeEmotion = async () => {
          if (
            !session.emotionRequested ||
            !current() ||
            session.flushing ||
            session.emotion ||
            session.emotionInitializing
          )
            return;
          session.emotionInitializing = true;
          const emotion = new Worker(
            new URL('../../infrastructure/inference/emotion.worker.ts', import.meta.url),
            { type: 'module' },
          );
          session.workers.push(emotion);
          const failedBranches = new Set<string>();
          emotion.addEventListener('message', (event) => {
            if (
              !current() ||
              event.data?.type !== 'branch-warning' ||
              failedBranches.has(event.data.branch)
            )
              return;
            failedBranches.add(event.data.branch);
            emitAudit('worker-failed', {
              branch: event.data.branch === 'voice' ? 'voice' : 'text',
              reason: 'worker-failed',
            });
          });
          try {
            await makeWorkerReady(emotion, { type: 'init' }, session.abort.signal);
            if (!current()) {
              emotion.terminate();
              return;
            }
            session.emotion = emotion;
            emotion.onmessage = (event) => {
              if (!current()) return;
              if (
                event.data.type === 'result' &&
                session.emotionTask &&
                session.emotionTask.segment.id === event.data.id
              ) {
                clearTimeout(session.emotionTimer);
                emitPipelineMetric({
                  stage: 'text',
                  durationMs: Math.max(0, performance.now() - textStartedAt),
                });
                void completeEmotion(event.data.evidence);
              }
              if (event.data.type === 'error') {
                clearTimeout(session.emotionTimer);
                if (session.emotionTask) void completeEmotion([]);
                if (session.pendingEmotion && !session.tone)
                  decide(session.pendingEmotion.segment, []);
                if (!session.tone) session.pendingEmotion = undefined;
                session.emotion = undefined;
                emotion.terminate();
                setError('Gợi ý tổng hợp tạm dừng; phụ đề và biểu cảm mặt vẫn hoạt động.');
                emitAudit('worker-failed', { branch: 'emotion', reason: 'worker-failed' });
                processEmotion();
                finishIfDone();
              }
            };
            emotion.onerror = () => {
              if (!current()) return;
              clearTimeout(session.emotionTimer);
              if (session.emotionTask) void completeEmotion([]);
              if (session.pendingEmotion && !session.tone)
                decide(session.pendingEmotion.segment, []);
              if (!session.tone) session.pendingEmotion = undefined;
              session.emotion = undefined;
              emotion.terminate();
              setError('Gợi ý tổng hợp tạm dừng; phụ đề và biểu cảm mặt vẫn hoạt động.');
              emitAudit('worker-failed', { branch: 'emotion', reason: 'worker-failed' });
              processEmotion();
              finishIfDone();
            };
            processEmotion();
          } catch {
            emotion.terminate();
            if (!current()) return;
            if (session.emotionTask) void completeEmotion([]);
            if (session.pendingEmotion && !session.tone) decide(session.pendingEmotion.segment, []);
            if (!session.tone) session.pendingEmotion = undefined;
            session.emotion = undefined;
            setError('Gợi ý tổng hợp chưa sẵn sàng; phụ đề và biểu cảm mặt vẫn hoạt động.');
            emitAudit('worker-failed', { branch: 'emotion', reason: 'worker-failed' });
            processEmotion();
            finishIfDone();
          } finally {
            session.emotionInitializing = false;
          }
        };
        session.enableContext = () => {
          if (!current() || session.flushing) return;
          session.emotionRequested = true;
          void initializeEmotion();
        };
        if (!current()) return;
        asr.onmessage = (event) => {
          if (!current()) return;
          if (event.data.type === 'error') {
            emitAudit('worker-failed', { branch: 'speech', reason: 'worker-failed' });
            fail(event.data.message);
            return;
          }
          if (event.data.type === 'partial') {
            const task = session.interimCurrent;
            if (!task || event.data.segment.id !== task.id) return;
            clearTimeout(session.timer);
            session.interimCurrent = undefined;
            recordPerformance(task, Number(event.data.segment.processingMs) || 0, true);
            const rawText = String(event.data.segment.text ?? '').trim();
            if (!rawText && session.asrProfile === 'moonshine-streaming-vi-research') {
              // The streaming engine can legitimately have no decoded token yet.
              // Do not flash an error or erase the same utterance's existing partial.
              setProvisional((caption) => (caption?.id === task.id ? caption : null));
              next();
              processEmotion();
              finishIfDone();
              return;
            }
            const unclear = !rawText || isSuspiciousRecognition(rawText);
            if (unclear) partialDisplay.reset();
            if (!unclear) recordDelivery(task, true);
            setProvisional({
              id: task.id,
              revision: task.revision ?? 0,
              startMs: task.startMs,
              endMs: task.endMs,
              text: unclear
                ? 'Chưa nghe rõ'
                : partialDisplay.update(task.id, task.revision ?? 0, rawText, task.endMs).text,
              state: unclear ? 'unclear' : 'interim',
            });
            next();
            processEmotion();
            finishIfDone();
            return;
          }
          if (event.data.type !== 'result' || event.data.segment.id !== session.current?.id) return;
          clearTimeout(session.timer);
          const task = session.current;
          if (!task) return;
          session.current = undefined;
          const asrSegment = event.data.segment as TranscriptSegment;
          partialDisplay.reset();
          recordPerformance(task, asrSegment.processingMs);
          if (task.id === session.pendingInterim?.id) session.pendingInterim = undefined;
          const rawAsrText = asrSegment.text.trim();
          if (!rawAsrText || isSuspiciousRecognition(rawAsrText)) {
            session.context.reset();
            setProvisional({
              id: task.id,
              revision: task.revision ?? 1,
              startMs: task.startMs,
              endMs: task.endMs,
              text: 'Chưa nghe rõ',
              state: 'unclear',
            });
            next();
            processEmotion();
            return;
          }
          setProvisional((caption) => (caption?.id === task.id ? null : caption));
          recordDelivery(task, false);
          const revision = reviseCaption(
            asrSegment.text,
            session.record.segments.slice(-2).map((item) => item.text),
          );
          const segment: TranscriptSegment = {
            ...asrSegment,
            boundary: task.boundary,
            utteranceId: task.utteranceId,
            text: revision.text,
            ...(revision.changed
              ? { rawText: revision.original, revision: revision.revision }
              : {}),
          };
          if (segment.text) {
            session.record.segments.push(segment);
            save(session);
            if (session.record.segments.length >= 500) {
              fail('Đã đạt giới hạn 500 đoạn. Hãy kết thúc và mở phiên mới.');
              return;
            }
            const context = session.context.accept(segment);
            if (context) enqueueEmotion({ segment: context, quality: task.quality, audio: task });
            else if (session.tone)
              enqueueEmotion({ segment, quality: task.quality, audio: task, textReady: false });
            else decide(segment, []);
          }
          next();
          processEmotion();
        };
        vad.onmessage = (event) => {
          if (!current()) return;
          if (event.data.type === 'error') {
            emitAudit('worker-failed', { branch: 'speech', reason: 'worker-failed' });
            fail(event.data.message);
            return;
          }
          if (event.data.type === 'activity' && !session.current && !session.interimCurrent)
            setStatus(event.data.speaking ? 'Đang nghe người đối diện…' : 'Đang chờ lời nói…');
          if (event.data.type === 'flushed') {
            session.flushed = true;
            session.pendingInterim = undefined;
            finishIfDone();
          }
          if (event.data.type === 'interim') {
            const chunk = event.data as SpeechChunk & { id: string; revision: number };
            session.pendingInterim = {
              id: chunk.id,
              revision: chunk.revision,
              samples: chunk.samples,
              startMs: session.startMs + chunk.startSample / 16,
              endMs: session.startMs + chunk.endSample / 16,
              quality: chunk.quality,
              boundary: chunk.boundary,
              utteranceId: chunk.utteranceId,
            };
            processInterim();
          }
          if (event.data.type === 'chunk') {
            const chunk = event.data as SpeechChunk & { id?: string };
            if (session.pendingInterim?.id === chunk.id) session.pendingInterim = undefined;
            if (session.queue.length >= 3) {
              emitAudit('performance-pressure', {
                branch: 'speech',
                enabled: true,
                count: session.queue.length,
              });
              fail(
                'Máy chưa theo kịp hội thoại. Đã dừng micro; hãy thử tắt phân tích sắc thái hoặc nói theo đoạn ngắn hơn.',
              );
              return;
            }
            session.queue.push({
              queuedAtMs: performance.now(),
              id: chunk.id ?? crypto.randomUUID(),
              samples: chunk.samples,
              startMs: session.startMs + chunk.startSample / 16,
              endMs: session.startMs + chunk.endSample / 16,
              quality: chunk.quality,
              boundary: chunk.boundary,
              utteranceId: chunk.utteranceId,
            });
            setWorkload(session.load.snapshot(session.queue, performance.now()));
            next();
          }
        };
        asr.onerror = () => {
          emitAudit('worker-failed', { branch: 'speech', reason: 'worker-failed' });
          fail('Worker phụ đề đã dừng. Hãy tải lại gói model và thử lại.');
        };
        vad.onerror = () => {
          emitAudit('worker-failed', { branch: 'speech', reason: 'worker-failed' });
          fail('Worker phát hiện tiếng nói đã dừng.');
        };
        session.startMs = performance.now();
        const started = await session.microphone.start(
          (samples, offset, capturedAtMs, captureGapMs) => {
            if (current()) {
              if (capturedAtMs !== undefined && Number.isFinite(capturedAtMs)) {
                const gapMs =
                  captureGapMs ??
                  (previousAudioStartMs === undefined
                    ? 0
                    : capturedAtMs - previousAudioStartMs - 32);
                previousAudioStartMs = capturedAtMs;
                if (gapMs > 96) emitPipelineMetric({ stage: 'audio-gap', durationMs: gapMs });
                if (gapMs > 500) {
                  emitAudit('performance-pressure', {
                    branch: 'audio',
                    enabled: true,
                    durationMs: gapMs,
                  });
                  fail(
                    'Âm thanh bị gián đoạn. Đã dừng phiên để tránh ghép sai lời nói; hãy bắt đầu lại.',
                  );
                  return;
                }
                session.startMs = capturedAtMs - offset / 16;
              } else if (offset === 0) session.startMs = performance.now() - 32;
              vad.postMessage({ type: 'frame', samples, offset }, [samples.buffer]);
            }
          },
          () => {
            emitAudit('worker-failed', { branch: 'audio', reason: 'device-missing' });
            fail('Micro đã ngắt. Hãy bắt đầu lại.');
          },
          options.microphoneStream,
          options.audioContext,
        );
        if (current() && started) {
          setState('running');
          setStatus('Đang chờ lời nói…');
          void initializeEmotion();
        }
        return current() && started;
      } catch (error) {
        if (current()) {
          fail(
            error instanceof DOMException && error.name === 'NotAllowedError'
              ? 'Chưa được cấp quyền micro. Cho phép micro trong trình duyệt rồi thử lại.'
              : error instanceof Error
                ? error.message
                : 'Không mở được hội thoại.',
          );
        }
        return false;
      }
    },
    [cancel, save, storage],
  );
  const finish = useCallback(() => {
    const session = active.current;
    if (!session) return;
    session.microphone.stop();
    session.flushing = true;
    setState('finishing');
    setStatus('Đã tắt micro. Đang hoàn tất những câu cuối…');
    session.vad?.postMessage({ type: 'flush' });
    clearTimeout(session.finishTimer);
    session.finishTimer = setTimeout(() => {
      setError('Đã dừng xử lý phần còn lại sau 60 giây. Các câu hoàn tất được giữ lại.');
      cancel();
    }, 60_000);
  }, [cancel]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden && active.current) {
        if (active.current)
          setStatus('Phiên đã dừng khi chuyển nền. Chỉ các câu đã hoàn tất được giữ.');
        cancel();
      }
      if (document.hidden) disableTone();
    };
    const leave = () => {
      if (active.current) cancel();
      disposePrepared();
    };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', leave);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', leave);
      cancel();
      disposePrepared();
    };
  }, [cancel, disposePrepared, disableTone]);
  const enableContext = useCallback(() => active.current?.enableContext?.(), []);
  return {
    state,
    status,
    error,
    clearError,
    record,
    provisional,
    getPreparationFailure: () => preparationFailure.current,
    evidence,
    workload,
    toneState,
    toneCached,
    prepareTone,
    disableTone,
    enableContext,
    preparedProfile,
    start,
    prepare,
    disposePrepared,
    finish,
    cancel,
    addFace: (result: InferenceResult) => active.current?.faces.add(result),
    resetFaceEvidence: (timestamp = performance.now()) => active.current?.faces.reset(timestamp),
  };
}
