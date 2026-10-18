import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Camera,
  FlipHorizontal,
  Mic,
  Play,
  Square,
  SwitchCamera,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Settings } from '../../shared/contracts';
import { expressionUI } from '../../shared/contracts';
import { PageTitle } from '../../shared/ui/PageTitle';
import { useCamera } from '../../infrastructure/media/useCamera';
import { conversationProfile } from '../../infrastructure/inference/conversationProfile';
import { useHaptics } from '../practice/useHaptics';
import { HapticDisplay } from '../practice/HapticDisplay';
import { useConversation } from './useConversation';
import { useFaceDisplay } from './useFaceDisplay';
import { CaptionEntry } from './CaptionEntry';
import type { FaceCue } from './HandSignCue';
import { FaceIllustration } from './FaceIllustration';
import { QuickPhrasePicker } from './QuickPhrasePicker';
import { SignPhraseCard } from './SignPhraseCard';
import { usePlayableSigns } from './usePlayableSigns';
import { useSignPlayback } from './useSignPlayback';
import { findPlayableSignPhrase } from '../../domain/signPhrases';
import { ConversationSaveControl } from './ConversationSaveControl';
import type { useVault } from '../history/useVault';
import { resultExplanation } from '../face/Diagnostics';
import { auditMessage } from '../../domain/audit';
import {
  retryModelPreparation,
  usePreparationStatus,
} from '../../infrastructure/offline/preparationStatus';
import { saveSettings } from '../../infrastructure/storage/database';
import { FaceInferenceBudget } from '../../domain/conversation';
import type { SessionMetrics } from '../../shared/contracts';
import type { AuxiliaryArtifact } from '../../infrastructure/inference/auxiliary';
import {
  beginAuditSession,
  emitAudit,
  endAuditSession,
  reportPermissionFailure,
  setAuditPhase,
  startupWasInterrupted,
  useAuditEvents,
} from '../../infrastructure/audit/log';

async function permissionDenialMessage() {
  if (!navigator.permissions?.query) return '';
  const statuses = await Promise.all(
    (['camera', 'microphone'] as PermissionName[]).map(async (name) => {
      try {
        return [name, (await navigator.permissions.query({ name })).state] as const;
      } catch {
        return [name, 'unknown'] as const;
      }
    }),
  );
  const denied = statuses.filter(([, state]) => state === 'denied').map(([name]) => name);
  if (denied.length === 2)
    return 'Chrome đang chặn camera và micro. Mở quyền trang web cạnh thanh địa chỉ, cho phép cả hai rồi thử lại.';
  if (denied.includes('camera'))
    return 'Chrome đang chặn camera. Mở quyền trang web cạnh thanh địa chỉ, cho phép camera rồi thử lại.';
  if (denied.includes('microphone'))
    return 'Chrome đang chặn micro. Mở quyền trang web cạnh thanh địa chỉ, cho phép micro rồi thử lại.';
  return '';
}

type ConstraintStatus = 'unknown' | 'unsupported' | 'on' | 'off';

function trackConstraintStatus(
  track: MediaStreamTrack,
  key: 'noiseSuppression' | 'echoCancellation',
): ConstraintStatus {
  if (typeof track.getSettings !== 'function') return 'unsupported';
  const settings = track.getSettings();
  if (!(key in settings)) return 'unsupported';
  return settings[key] === true ? 'on' : 'off';
}

import {
  ModelInitializationError,
  modelInitializationCode,
  modelInitializationMessage,
  modelInitializationAuditReason,
} from '../../domain/modelInitialization';

export function ConversationPage({
  settings,
  changeSettings,
  store,
  onActive,
  onToggleSound,
  onMetrics,
  candidate,
  visible = true,
  onPrepared,
  openSettings,
  openHistory,
  compatibleFace: controlledCompatibleFace,
  onCompatibleFaceChange,
  autoFallbackGpu = false,
}: {
  settings: Settings;
  visible?: boolean;
  onPrepared?: (
    ready: boolean,
    failed?: boolean,
    settled?: boolean,
    failureMessage?: string,
  ) => void;
  changeSettings?: (next: Settings) => void;
  store: ReturnType<typeof useVault>;
  onActive: (active: boolean) => void;
  onToggleSound?: () => void;
  onMetrics?: (metrics: SessionMetrics | null, modelVersion: string) => void;
  candidate?: AuxiliaryArtifact | null;
  openSettings?: () => void;
  openHistory?: () => void;
  compatibleFace?: boolean;
  onCompatibleFaceChange?: (compatible: boolean) => void;
  autoFallbackGpu?: boolean;
}) {
  const [consent, setConsent] = useState(false);
  const [fusionEnabled, setFusionEnabled] = useState(() => !startupWasInterrupted());
  const [recoveryMode, setRecoveryMode] = useState(() => startupWasInterrupted());
  const persist = settings.saveConversations === true;
  const [skipSave, setSkipSave] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(28);
  const [message, setMessage] = useState('');
  const [aiReady, setAiReady] = useState(false);
  const [preparationPaused, setPreparationPaused] = useState(false);
  const [coreWarmupFailed, setCoreWarmupFailed] = useState(false);
  const [internalCompatibleFace, setInternalCompatibleFace] = useState(false);
  const compatibleFace = controlledCompatibleFace ?? internalCompatibleFace;
  const updateCompatibleFace = useCallback(
    (value: boolean) => {
      setInternalCompatibleFace(value);
      onCompatibleFaceChange?.(value);
    },
    [onCompatibleFaceChange],
  );
  const [failedBranch, setFailedBranch] = useState<'speech' | 'face' | null>(null);
  const [warmupAttempt, setWarmupAttempt] = useState(0);
  const [checking, setChecking] = useState(false);
  const [phase, setPhase] = useState('');
  const [soundFeedback, setSoundFeedback] = useState(settings.soundFeedback);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [mirrorMode, setMirrorMode] = useState(settings.cameraMirror);
  const [faceIntervalMs, setFaceIntervalMs] = useState(200);
  const [noiseSuppression, setNoiseSuppression] = useState<ConstraintStatus>('unknown');
  const [echoCancellation, setEchoCancellation] = useState<ConstraintStatus>('unknown');
  const requestGeneration = useRef(0);
  const metricsCallback = useRef(onMetrics);
  metricsCallback.current = onMetrics;
  const workloadRef = useRef<{ pendingAsr: number; rtf: number; oldestFinalWaitMs?: number }>({
    pendingAsr: 0,
    rtf: 0,
  });
  const inferenceBudget = useRef(new FaceInferenceBudget());
  const lastFaceInterval = useRef(200);
  const pendingStream = useRef<MediaStream | null>(null);
  const sessionStreams = useRef<MediaStream[]>([]);
  const backgroundStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureContext = useRef<AudioContext | null>(null);
  const closeCaptureContext = () => {
    const context = captureContext.current;
    captureContext.current = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  };
  const preparation = usePreparationStatus();
  const auditEvents = useAuditEvents();
  const {
    coreReady,
    fusionReady,
    preparing,
    progress,
    detail: downloadDetail,
    error: preparationError,
    offline,
  } = preparation;
  const haptics = useHaptics(
    settings.hapticMode ?? (settings.haptics ? 'auto' : 'off'),
    soundFeedback,
  );
  const [faceCue, setFaceCue] = useState<FaceCue | null>(null);
  const faceCueSerial = useRef(0);
  const allowFaceCue = useRef(false);
  const handleFaceCue = useCallback(
    (label: Parameters<typeof haptics.play>[0]) => {
      if (!allowFaceCue.current || document.hidden || label === 'neutral') return null;
      setFaceCue({ id: ++faceCueSerial.current, label, timestamp: performance.now() });
      return haptics.play(label, 'stable-change');
    },
    [haptics.play],
  );
  const runtimeProfile = conversationProfile();
  const camera = useCamera(
    settings,
    handleFaceCue,
    candidate,
    200,
    compatibleFace ? 'b0-wasm-research' : runtimeProfile.face,
  );
  const conversation = useConversation(store.vault, store.persistence);
  const availableSigns = usePlayableSigns(settings.signPhrasePlayback !== false);
  const signs = useSignPlayback(
    conversation.record,
    settings.signPhrasePlayback !== false,
    visible && conversation.state === 'running',
    availableSigns,
  );
  const [sampleNotice, setSampleNotice] = useState('');
  const [signCardActive, setSignCardActive] = useState(false);
  const diagnosticsVisible =
    ['127.0.0.1', 'localhost'].includes(location.hostname) &&
    new URLSearchParams(location.search).has('diagnostics');
  const previousConversationState = useRef(conversation.state);
  const [toneEnabled, setToneEnabled] = useState(false);
  const isLocalMoonshineOrigin =
    ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname) &&
    window.location.protocol.startsWith('http');
  // Keep the research selector closed until the pinned WASM runtime can load
  // the Vietnamese streaming frontend split files in an actual browser.
  const moonshineRuntimeCompatible = runtimeProfile.asr === 'moonshine-streaming-vi-research';
  const moonshineAvailable =
    isLocalMoonshineOrigin && window.crossOriginIsolated && moonshineRuntimeCompatible;
  const requestedProfile = settings.asrProfile ?? 'product';
  const activeAsrProfile =
    runtimeProfile.id === 'pc-candidate'
      ? runtimeProfile.asr === 'moonshine-streaming-vi-research' && !moonshineAvailable
        ? 'product'
        : runtimeProfile.asr
      : requestedProfile === 'moonshine-streaming-vi-research' && moonshineAvailable
        ? requestedProfile
        : 'product';
  const moonshineNeedsLocalMode =
    runtimeProfile.id === 'baseline' &&
    requestedProfile === 'moonshine-streaming-vi-research' &&
    (!isLocalMoonshineOrigin || !window.crossOriginIsolated);
  const moonshineRuntimeUnavailable =
    runtimeProfile.id === 'baseline' &&
    requestedProfile === 'moonshine-streaming-vi-research' &&
    isLocalMoonshineOrigin &&
    window.crossOriginIsolated &&
    !moonshineRuntimeCompatible;
  const modelReady =
    aiReady &&
    conversation.preparedProfile === activeAsrProfile &&
    (!toneEnabled || conversation.toneState === 'ready');
  useEffect(() => {
    onPrepared?.(
      modelReady,
      coreWarmupFailed,
      preparationPaused,
      coreWarmupFailed ? message : undefined,
    );
    return () => onPrepared?.(false);
  }, [modelReady, coreWarmupFailed, preparationPaused, onPrepared, message]);
  const aiPreparing =
    coreReady && !aiReady && !preparationPaused && !message && conversation.state === 'idle';
  workloadRef.current = conversation.workload;
  const running = checking || conversation.state !== 'idle';
  useEffect(() => {
    if (conversation.state === 'running' && fusionEnabled && fusionReady)
      conversation.enableContext();
  }, [conversation.state, conversation.enableContext, fusionEnabled, fusionReady]);
  const activeAttempt = useRef(false);
  const pageUnloading = useRef(false);
  activeAttempt.current = running || camera.state !== 'idle';

  useEffect(
    () => () => {
      requestGeneration.current++;
      pendingStream.current?.getTracks().forEach((track) => track.stop());
      sessionStreams.current.forEach((stream) =>
        stream.getTracks().forEach((track) => track.stop()),
      );
      pendingStream.current = null;
      sessionStreams.current = [];
      closeCaptureContext();
      camera.stop();
      conversation.cancel();
      haptics.cancel();
      if (activeAttempt.current) {
        if (!pageUnloading.current) emitAudit('conversation-ended', { phase: 'ready' });
        if (!pageUnloading.current) {
          endAuditSession();
          setAuditPhase('ready');
        }
      }
      metricsCallback.current?.(camera.getMetrics(), camera.getModelVersion());
    },
    [],
  );
  useEffect(() => {
    onActive(running);
    return () => onActive(false);
  }, [running, onActive]);
  useEffect(() => setSoundFeedback(settings.soundFeedback), [settings.soundFeedback]);
  useEffect(() => setMirrorMode(settings.cameraMirror), [settings.cameraMirror]);
  useEffect(() => {
    if (
      pageUnloading.current ||
      preparationPaused ||
      !coreReady ||
      conversation.state !== 'idle' ||
      camera.state !== 'idle' ||
      document.hidden
    )
      return;
    let cancelled = false;
    let branch: 'speech' | 'face' = 'speech';
    setAiReady(false);
    setCoreWarmupFailed(false);
    setPhase(
      activeAsrProfile === 'moonshine-streaming-vi-research'
        ? 'Đang chuẩn bị Moonshine tiếng Việt trên thiết bị…'
        : 'Đang chuẩn bị phụ đề và nhận diện khuôn mặt…',
    );
    emitAudit('ai-preparing', { phase: 'preparing-ai' });
    setAuditPhase('preparing-ai');
    void (async () => {
      const [asrSuccess, faceSuccess] = await Promise.all([
        conversation.prepare(activeAsrProfile),
        camera.prepare(),
      ]);
      if (!asrSuccess) {
        branch = 'speech';
        throw new ModelInitializationError(conversation.getPreparationFailure());
      }
      if (!faceSuccess) {
        branch = 'face';
        throw new ModelInitializationError(camera.getPreparationFailure());
      }
      if (cancelled || document.hidden || pageUnloading.current) return;
      setAiReady(true);
      setPhase('');
      emitAudit('ai-ready', { phase: 'ready' });
      setAuditPhase('ready');
    })().catch((reason: unknown) => {
      if (cancelled || document.hidden || pageUnloading.current) return;
      conversation.disposePrepared();
      camera.disposePrepared();
      setPhase('');
      const code = modelInitializationCode(reason);
      setFailedBranch(branch);
      if (autoFallbackGpu && branch === 'face' && code === 'gpu' && !compatibleFace) {
        emitAudit('ai-preparation-failed', {
          branch: 'face',
          reason: 'unsupported-browser',
        });
        updateCompatibleFace(true);
        setCoreWarmupFailed(false);
        setMessage('');
        setWarmupAttempt((attempt) => attempt + 1);
        return;
      }
      setMessage(modelInitializationMessage(branch, code));
      setCoreWarmupFailed(true);
      emitAudit('ai-preparation-failed', {
        branch,
        reason: modelInitializationAuditReason(code),
      });
      setAuditPhase('ready');
    });
    return () => {
      cancelled = true;
      if (!activeAttempt.current) {
        conversation.disposePrepared();
        camera.disposePrepared();
      }
    };
  }, [
    coreReady,
    conversation.state,
    conversation.prepare,
    conversation.disposePrepared,
    camera.state,
    camera.prepare,
    camera.disposePrepared,
    candidate,
    activeAsrProfile,
    warmupAttempt,
    preparationPaused,
  ]);
  useEffect(() => {
    const resumeWarmup = () => {
      if (!document.hidden) setWarmupAttempt((attempt) => attempt + 1);
      else if (!activeAttempt.current) {
        conversation.disposePrepared();
        camera.disposePrepared();
        setAiReady(false);
        setPhase('');
        setWarmupAttempt((attempt) => attempt + 1);
        onPrepared?.(false, false, true);
      }
    };
    document.addEventListener('visibilitychange', resumeWarmup);
    return () => document.removeEventListener('visibilitychange', resumeWarmup);
  }, []);
  useEffect(() => {
    conversation.addFace(camera.result);
  }, [camera.result]);
  useEffect(() => {
    const previous = previousConversationState.current;
    previousConversationState.current = conversation.state;
    if (conversation.state === 'idle') {
      if (camera.state !== 'idle') camera.stop();
      if (previous !== 'idle') {
        setSkipSave(false);
        haptics.release();
        conversation.disableTone();
        setToneEnabled(false);
        setPreparationPaused(true);
        setAiReady(false);
        conversation.disposePrepared();
        camera.disposePrepared();
      }
      if (checkingRef.current) haptics.cancel();
    }
  }, [
    conversation.state,
    conversation.disposePrepared,
    conversation.disableTone,
    camera.state,
    camera.stop,
    camera.disposePrepared,
    haptics.cancel,
    haptics.release,
  ]);
  useEffect(() => {
    if (conversation.state !== 'running') return;
    const timer = setInterval(() => {
      const workload = workloadRef.current;
      const nextInterval = inferenceBudget.current.update(
        performance.now(),
        workload.pendingAsr,
        workload.rtf,
        camera.getRecentServiceMs(),
        workload.oldestFinalWaitMs ?? 0,
      );
      if (nextInterval !== lastFaceInterval.current) {
        emitAudit('performance-pressure', {
          branch: 'face',
          enabled: nextInterval > lastFaceInterval.current,
          durationMs: camera.getLiveP95(),
          count: workload.pendingAsr,
        });
        lastFaceInterval.current = nextInterval;
      }
      camera.setFrameIntervalMs(nextInterval);
      setFaceIntervalMs(nextInterval);
    }, 1000);
    return () => clearInterval(timer);
  }, [conversation.state, camera.setFrameIntervalMs, camera.getLiveP95, camera.getRecentServiceMs]);
  useEffect(() => {
    // A failed device switch can leave the current camera track usable. Keep
    // the conversation alive in that case and surface the switch error inline.
    if (!camera.error || camera.state === 'running' || (!checking && conversation.state === 'idle'))
      return;
    requestGeneration.current++;
    pendingStream.current?.getTracks().forEach((track) => track.stop());
    pendingStream.current = null;
    sessionStreams.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
    sessionStreams.current = [];
    closeCaptureContext();
    checkingRef.current = false;
    setChecking(false);
    setPhase('');
    setMessage(`Đã dừng phiên vì không mở được camera: ${camera.error}`);
    conversation.cancel();
    haptics.release();
  }, [camera.error, checking, conversation.state, conversation.cancel, haptics.release]);

  const checkingRef = useRef(false);
  const toggleSound = () => {
    if (onToggleSound) {
      onToggleSound();
      return;
    }
    const next = { ...settings, soundFeedback: !soundFeedback };
    setSoundFeedback(next.soundFeedback);
    emitAudit('sound-changed', { enabled: next.soundFeedback, branch: 'audio' });
    void saveSettings(next);
    window.dispatchEvent(new CustomEvent('signemo-settings-change', { detail: next }));
  };
  const cancelStart = (reason: 'user-canceled' | 'background' | 'pagehide' = 'user-canceled') => {
    const hasActiveAttempt =
      checkingRef.current ||
      conversation.state !== 'idle' ||
      camera.state !== 'idle' ||
      pendingStream.current !== null;
    if (!hasActiveAttempt) return;
    requestGeneration.current++;
    pendingStream.current?.getTracks().forEach((track) => track.stop());
    pendingStream.current = null;
    sessionStreams.current.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
    sessionStreams.current = [];
    closeCaptureContext();
    checkingRef.current = false;
    setChecking(false);
    setPhase('');
    setMessage(
      reason === 'user-canceled'
        ? 'Đã hủy. Nếu hộp thoại quyền còn mở, hãy đóng hộp thoại đó.'
        : reason === 'background'
          ? 'Phiên đã dừng khi ứng dụng chuyển nền. Camera và micro đã tắt.'
          : '',
    );
    camera.stop();
    conversation.cancel();
    camera.disposePrepared();
    conversation.disposePrepared();
    setAiReady(false);
    setPreparationPaused(true);
    haptics.release();
    if (reason === 'user-canceled') emitAudit('conversation-canceled', { reason });
    else if (reason === 'pagehide')
      emitAudit('pagehide-stopped', { reason: 'unknown', phase: 'running' });
    else emitAudit('background-stopped', { reason: 'background', phase: 'running' });
    if (reason !== 'pagehide') endAuditSession();
    if (reason !== 'pagehide') setAuditPhase('ready');
  };
  useEffect(() => {
    if (!visible && activeAttempt.current) cancelStart('user-canceled');
  }, [visible]);
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === 'hidden') {
        if (backgroundStopTimer.current) clearTimeout(backgroundStopTimer.current);
        backgroundStopTimer.current = setTimeout(() => {
          backgroundStopTimer.current = null;
          if (document.visibilityState === 'hidden' && !pageUnloading.current)
            cancelStart('background');
        }, 100);
      } else if (backgroundStopTimer.current) {
        clearTimeout(backgroundStopTimer.current);
        backgroundStopTimer.current = null;
      }
    };
    const leave = () => {
      pageUnloading.current = true;
      if (backgroundStopTimer.current) clearTimeout(backgroundStopTimer.current);
      backgroundStopTimer.current = null;
      cancelStart('pagehide');
      conversation.disposePrepared();
      camera.disposePrepared();
    };
    const beforeLeave = () => {
      pageUnloading.current = true;
    };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', leave);
    window.addEventListener('beforeunload', beforeLeave);
    return () => {
      if (backgroundStopTimer.current) clearTimeout(backgroundStopTimer.current);
      backgroundStopTimer.current = null;
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('beforeunload', beforeLeave);
    };
  }, [camera.state, camera.stop, conversation.state, conversation.cancel, haptics.cancel]);

  const start = async () => {
    if (!visible) return;
    if (checkingRef.current || !consent || !coreReady || !modelReady) return;
    if (persist && !skipSave && !store.vault.unlocked) {
      setMessage('Mở khóa lịch sử bên dưới, hoặc chọn tiếp tục không lưu phiên này.');
      return;
    }
    if (store.persistence.unsaved) {
      setMessage(
        'Còn hội thoại chưa lưu. Hãy lưu lại hoặc bỏ phần chưa lưu trước khi mở phiên mới.',
      );
      return;
    }
    checkingRef.current = true;
    const generation = ++requestGeneration.current;
    beginAuditSession();
    emitAudit('permission-requested', { phase: 'requesting-permission' });
    setAuditPhase('requesting-permission');
    let devicesOpened = false;
    inferenceBudget.current = new FaceInferenceBudget();
    camera.setFrameIntervalMs(200);
    lastFaceInterval.current = 200;
    setFaceIntervalMs(200);
    setChecking(true);
    setPhase('Đang xin quyền camera và micro…');
    setMessage('');
    camera.clearError();
    conversation.clearError();
    let requestingDevices = false;
    let missingTrack = false;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
        throw new Error('Camera và micro cần HTTPS hoặc localhost trên trình duyệt được hỗ trợ.');
      if ((settings.hapticMode ?? 'auto') === 'auto' && soundFeedback) void haptics.unlock();
      const audioContext = new AudioContext();
      captureContext.current = audioContext;
      // Activate capture in the click handler, before model initialization awaits.
      const audioReady = audioContext.resume().then(
        () => audioContext.state === 'running',
        () => false,
      );
      // Call getUserMedia before the first await so Chrome ties both permission prompts
      // to this explicit user action.
      requestingDevices = true;
      const request = navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
        video: { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 480 } },
      });
      const stream = await request;
      if (generation !== requestGeneration.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      pendingStream.current = stream;
      devicesOpened = true;
      emitAudit('devices-opened', { phase: 'connecting' });
      setAuditPhase('connecting');
      setPhase('Đang kết nối phụ đề và camera…');
      if (!(await audioReady)) throw new Error('Chưa bật được xử lý micro. Bấm bắt đầu lại.');
      if (generation !== requestGeneration.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      if (!videoTracks.length || !audioTracks.length) {
        missingTrack = true;
        throw new Error('Cần cả camera và micro để bắt đầu. Kiểm tra thiết bị rồi thử lại.');
      }
      setNoiseSuppression(trackConstraintStatus(audioTracks[0], 'noiseSuppression'));
      setEchoCancellation(trackConstraintStatus(audioTracks[0], 'echoCancellation'));

      const cameraStream = new MediaStream(videoTracks);
      const microphoneStream = new MediaStream(audioTracks);
      sessionStreams.current = [cameraStream, microphoneStream];
      pendingStream.current = null;
      setPhase('Đang khởi động AI trên thiết bị…');
      const microphoneStart = conversation
        .start({
          emotion: fusionEnabled && fusionReady,
          tone: toneEnabled && fusionEnabled,
          persist: persist && !skipSave,
          asrProfile: activeAsrProfile,
          microphoneStream,
          audioContext,
        })
        .then(
          (ready) => {
            if (!ready && generation === requestGeneration.current) camera.stop();
            return ready;
          },
          (error: unknown) => {
            if (generation === requestGeneration.current) camera.stop();
            throw error;
          },
        );
      const cameraStart = camera.start('user', cameraStream).then(
        (ready) => {
          if (!ready && generation === requestGeneration.current) conversation.cancel();
          return ready;
        },
        (error: unknown) => {
          if (generation === requestGeneration.current) conversation.cancel();
          throw error;
        },
      );
      const [microphoneReady, cameraReady] = await Promise.all([microphoneStart, cameraStart]);
      if (generation !== requestGeneration.current) {
        cameraStream.getTracks().forEach((track) => track.stop());
        microphoneStream.getTracks().forEach((track) => track.stop());
        if (audioContext.state !== 'closed') void audioContext.close().catch(() => {});
        return;
      }
      if (!microphoneReady || !cameraReady) {
        camera.stop();
        conversation.cancel();
        microphoneStream.getTracks().forEach((track) => track.stop());
        cameraStream.getTracks().forEach((track) => track.stop());
        sessionStreams.current = [];
        closeCaptureContext();
        haptics.release();
        setMessage(
          camera.error || conversation.error || 'Chưa khởi động được camera và micro. Hãy thử lại.',
        );
        emitAudit('worker-failed', {
          branch: camera.error ? 'face' : 'speech',
          reason: 'worker-failed',
        });
        endAuditSession();
        setAuditPhase('ready');
        return;
      }
      sessionStreams.current = [];
      captureContext.current = null;
      setPhase('Đang nghe…');
      setMessage('');
      emitAudit('conversation-started', { phase: 'running' });
      setAuditPhase('running');
    } catch (error) {
      if (generation === requestGeneration.current) {
        pendingStream.current?.getTracks().forEach((track) => track.stop());
        pendingStream.current = null;
        sessionStreams.current.forEach((stream) =>
          stream.getTracks().forEach((track) => track.stop()),
        );
        sessionStreams.current = [];
        camera.stop();
        conversation.cancel();
        haptics.release();
        closeCaptureContext();
        const name = error instanceof DOMException ? error.name : '';
        if (requestingDevices && !devicesOpened) reportPermissionFailure(name);
        else if (missingTrack) reportPermissionFailure('NotFoundError');
        else if (devicesOpened)
          emitAudit('worker-failed', {
            branch: camera.error ? 'face' : 'speech',
            reason: 'worker-failed',
          });
        else emitAudit('worker-failed', { branch: 'audio', reason: 'unknown' });
        const denied =
          name === 'NotAllowedError' || name === 'PermissionDeniedError'
            ? await permissionDenialMessage()
            : '';
        if (generation !== requestGeneration.current) return;
        setMessage(
          denied ||
            (name === 'NotAllowedError' || name === 'PermissionDeniedError'
              ? 'Chưa được cấp quyền camera và micro. Cho phép cả hai ở biểu tượng quyền trên thanh địa chỉ rồi thử lại.'
              : name === 'NotFoundError'
                ? 'Không tìm thấy camera hoặc micro. Kết nối thiết bị rồi thử lại.'
                : name === 'NotReadableError'
                  ? 'Camera hoặc micro đang được ứng dụng khác sử dụng. Đóng ứng dụng đó rồi thử lại.'
                  : error instanceof Error
                    ? error.message
                    : 'Không thể mở camera và micro.'),
        );
        endAuditSession();
        setAuditPhase('ready');
      }
    } finally {
      if (generation === requestGeneration.current) {
        checkingRef.current = false;
        setChecking(false);
        setPhase('');
      }
    }
  };

  const segments = conversation.record?.segments ?? [];
  const latest = conversation.record?.decisions.findLast(
    (item) => item.segmentId === segments.at(-1)?.id,
  );
  const faceSourceActive =
    visible &&
    conversation.state === 'running' &&
    camera.state === 'running' &&
    !camera.switching &&
    camera.result.status === 'valid';
  allowFaceCue.current =
    visible && conversation.state === 'running' && camera.state === 'running' && !camera.switching;
  useEffect(() => {
    if (!faceSourceActive) {
      setFaceCue(null);
      haptics.cancel();
    }
  }, [faceSourceActive, haptics.cancel]);
  const faceDisplay = useFaceDisplay(
    camera.result,
    camera.state === 'running' && !camera.switching,
  );
  const faceLabel = faceDisplay.label;
  const rejectedText = conversation.evidence.find(
    (item) => item.source === 'text' && item.quality === 'rejected',
  );
  const mirrored = mirrorMode === 'auto' ? facing === 'user' : mirrorMode === 'mirror';
  const toggleMirror = () => {
    const next: Settings['cameraMirror'] = mirrored ? 'normal' : 'mirror';
    const updated = { ...settings, cameraMirror: next };
    setMirrorMode(next);
    void saveSettings(updated);
    window.dispatchEvent(new CustomEvent('signemo-settings-change', { detail: updated }));
  };
  const switchCamera = async () => {
    const next = facing === 'user' ? 'environment' : 'user';
    conversation.resetFaceEvidence(performance.now());
    haptics.cancel();
    setPhase('Đang đổi camera…');
    const switched = await camera.switchCamera();
    if (switched) {
      setFacing(next);
      setMessage('');
      emitAudit('camera-changed', { branch: 'face' });
    } else {
      emitAudit('camera-change-failed', { branch: 'face', reason: 'unknown' });
    }
    setPhase('');
  };

  const cameraEmotionColor =
    settings.captionColors !== false && faceSourceActive && faceLabel
      ? expressionUI[faceLabel].color
      : undefined;

  return (
    <>
      <PageTitle
        eyebrow="SIGNEMO · HỘI THOẠI"
        title="Ở đây, mình hiểu nhau."
        subtitle="Lời nói thành phụ đề. Mọi xử lý diễn ra trên thiết bị."
      />
      {recoveryMode && (
        <div className="recovery-notice" role="status">
          Phiên trước bị gián đoạn — đang dùng chế độ nhẹ. Phụ đề và biểu cảm mặt vẫn hoạt động.
        </div>
      )}
      <div className="conversation-layout">
        <section className="conversation-main">
          <div className="conversation-capture">
            <div
              className={`conversation-video camera-emotion-frame${cameraEmotionColor ? ' camera-emotion-active' : ''}`}
              style={
                cameraEmotionColor
                  ? ({ '--camera-accent': cameraEmotionColor } as CSSProperties)
                  : undefined
              }
            >
              <video
                ref={camera.videoRef}
                className={mirrored ? 'is-mirrored' : undefined}
                muted
                playsInline
                aria-label="Người đối diện"
              />
              {camera.state === 'idle' && (
                <div className="video-empty">
                  <Camera size={32} />
                  <p>Camera và micro sẽ mở sau khi bạn bắt đầu.</p>
                </div>
              )}
              <span className="video-label">
                {camera.switching
                  ? 'Đang chuyển camera…'
                  : camera.state === 'running'
                    ? 'Hình ảnh được xử lý trên thiết bị'
                    : 'Camera đang tắt'}
              </span>
              {camera.state === 'running' && (
                <div className="video-controls">
                  <button
                    className="video-switch"
                    type="button"
                    disabled={camera.switching}
                    onClick={() => void switchCamera()}
                    aria-label="Đổi sang thiết bị camera khác"
                  >
                    <SwitchCamera size={18} /> Đổi camera
                  </button>
                  <button
                    className="video-switch video-mirror"
                    type="button"
                    onClick={toggleMirror}
                    aria-pressed={mirrored}
                    aria-label={mirrored ? 'Tắt lật gương ảnh camera' : 'Bật lật gương ảnh camera'}
                  >
                    <FlipHorizontal size={18} /> {mirrored ? 'Ảnh gương' : 'Lật ảnh'}
                  </button>
                </div>
              )}
            </div>
            <label className="checkbox-label consent-line">
              <input
                type="checkbox"
                checked={consent}
                disabled={running}
                onChange={(event) => setConsent(event.target.checked)}
              />
              <span>Tôi từ 18 tuổi và người đối diện đồng ý dùng camera, micro.</span>
            </label>
            <div className="conversation-controls conversation-toolbar-container">
              <button
                className="button primary session-start-btn"
                disabled={
                  (!consent && !running) ||
                  (!modelReady && !running) ||
                  conversation.state === 'finishing'
                }
                onClick={() => {
                  if (checking) cancelStart();
                  else if (conversation.state === 'running') {
                    setPreparationPaused(true);
                    setAiReady(false);
                    camera.stop();
                    onMetrics?.(camera.getMetrics(), camera.getModelVersion());
                    haptics.release();
                    conversation.finish();
                    emitAudit('conversation-ended', { phase: 'ready' });
                    endAuditSession();
                    setAuditPhase('ready');
                  } else if (conversation.state === 'loading') cancelStart();
                  else void start();
                }}
              >
                {running ? <Square size={18} /> : <Play size={18} />}{' '}
                {checking
                  ? 'Hủy'
                  : conversation.state === 'loading'
                    ? 'Hủy khởi động'
                    : conversation.state === 'finishing'
                      ? 'Đang hoàn tất…'
                      : running
                        ? 'Kết thúc hội thoại'
                        : 'Bắt đầu hội thoại'}
              </button>
              <div className="practice-action-toolbar conversation-audio-group">
                <button
                  className="button secondary sound-toggle"
                  type="button"
                  onClick={toggleSound}
                  aria-pressed={soundFeedback}
                  title={soundFeedback ? 'Tắt âm báo trên máy tính' : 'Bật âm báo trên máy tính'}
                >
                  {soundFeedback ? <Volume2 size={17} /> : <VolumeX size={17} />}
                  {soundFeedback ? 'Âm báo bật' : 'Âm báo tắt'}
                </button>
                <button
                  className="button secondary test-sound-btn"
                  type="button"
                  onClick={() => {
                    emitAudit('haptic-test', { branch: 'audio' });
                    void haptics.testSound();
                  }}
                >
                  Thử âm
                </button>
              </div>
              <span className="session-status" role="status">
                <Mic size={16} />
                {checking || phase
                  ? phase
                  : aiPreparing
                    ? 'Đang chuẩn bị AI trên thiết bị…'
                    : conversation.status}
              </span>
            </div>

            <ConversationSaveControl
              store={store}
              enabled={persist}
              running={running}
              skip={skipSave}
              onChange={(value) => {
                setSkipSave(false);
                if (changeSettings) changeSettings({ ...settings, saveConversations: value });
                else void saveSettings({ ...settings, saveConversations: value });
              }}
              onSkip={() => {
                setSkipSave(true);
                setMessage('');
              }}
            />
            {coreReady && preparationPaused && !running && !message && (
              <div className="model-readiness" role="status">
                <span>Đã giải phóng AI của phiên trước.</span>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setPreparationPaused(false);
                    setWarmupAttempt((attempt) => attempt + 1);
                  }}
                >
                  Chuẩn bị phiên mới
                </button>
              </div>
            )}
            {coreReady && !aiReady && message && !running && (
              <div className="model-readiness" role="status">
                <span>AI chưa sẵn sàng cho phiên này.</span>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setMessage('');
                    setPreparationPaused(false);
                    setWarmupAttempt((attempt) => attempt + 1);
                  }}
                >
                  Thử chuẩn bị lại
                </button>
                {failedBranch === 'face' &&
                  runtimeProfile.id === 'pc-candidate' &&
                  !compatibleFace && (
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => {
                        setMessage('');
                        updateCompatibleFace(true);
                        setCoreWarmupFailed(false);
                        setWarmupAttempt((attempt) => attempt + 1);
                      }}
                    >
                      Dùng chế độ tương thích
                    </button>
                  )}
              </div>
            )}

            {compatibleFace && (
              <p className="fine-note" role="status">
                Đang dùng chế độ tương thích cho khuôn mặt; phản hồi có thể chậm hơn.
              </p>
            )}

            {!offline && (!coreReady || preparing || Boolean(preparationError)) && (
              <div className="model-readiness" role="status">
                <span>
                  {preparing
                    ? `Đang chuẩn bị SignEmo · ${progress}%`
                    : preparationError
                      ? 'Chưa tải xong tài nguyên cần thiết.'
                      : 'Đang kiểm tra tài nguyên trên thiết bị…'}
                </span>
                {preparing && <progress max="100" value={progress} aria-label="Tiến độ chuẩn bị" />}
                {downloadDetail && <small>{downloadDetail}</small>}
                {preparationError && (
                  <>
                    <small>{preparationError}</small>
                    <button className="text-button" type="button" onClick={retryModelPreparation}>
                      Thử lại
                    </button>
                  </>
                )}
              </div>
            )}
            {haptics.audioState === 'error' && (
              <p className="fine-note" role="status">
                Chưa bật được âm báo. Bấm “Thử âm” để thử lại.
              </p>
            )}
            {(noiseSuppression === 'off' || noiseSuppression === 'unsupported') && running && (
              <p className="fine-note" role="status">
                {noiseSuppression === 'off'
                  ? 'Khử nhiễu chưa bật được. Hãy thử nơi yên tĩnh hơn.'
                  : 'Trình duyệt không báo trạng thái khử nhiễu. Hãy thử nơi yên tĩnh hơn nếu âm thanh nhiễu.'}
              </p>
            )}

            {(message || conversation.error || camera.error) && (
              <div className="error-box conversation-error" role="alert">
                {message || conversation.error || camera.error}
              </div>
            )}
          </div>
          <section className="caption-panel" aria-label="Phụ đề hội thoại">
            <header>
              <h2>Lời người đối diện</h2>
              <label>
                Cỡ chữ{' '}
                <input
                  type="range"
                  min="20"
                  max="36"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  aria-label="Cỡ chữ phụ đề"
                />
              </label>
            </header>
            <div className="caption-scroll" style={{ fontSize }}>
              {segments.length || conversation.provisional ? (
                <>
                  {segments.length > 30 && (
                    <p className="fine-note caption-older-note">Đang hiển thị 30 đoạn gần nhất.</p>
                  )}
                  {segments.slice(-30).map((segment) => (
                    <CaptionEntry
                      key={segment.id}
                      segment={segment}
                      decision={conversation.record?.decisions.findLast(
                        (item) => item.segmentId === segment.id,
                      )}
                      colors={settings.captionColors !== false}
                      signLanguageCues={settings.signPhrasePlayback !== false}
                      signPhrase={findPlayableSignPhrase(
                        signs.utterances.find((item) => item.segmentId === segment.id)?.text ??
                          segment.text,
                        availableSigns,
                      )}
                      onViewSign={(phrase) => {
                        setSampleNotice('');
                        signs.select(phrase);
                      }}
                    />
                  ))}
                  {conversation.provisional && (
                    <div
                      className={`caption-entry provisional-caption ${conversation.provisional.state}`}
                    >
                      <p>{conversation.provisional.text}</p>
                      {conversation.provisional.state === 'interim' && (
                        <small>Đang nhận dạng…</small>
                      )}
                      {conversation.provisional.state === 'unclear' && (
                        <small>Hãy thử nói lại ngắn gọn.</small>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="caption-placeholder">Phụ đề sẽ xuất hiện ở đây.</p>
              )}
            </div>
            <div className="caption-live" aria-live="polite" aria-atomic="true">
              {segments.at(-1)?.text ?? ''}
            </div>
          </section>
        </section>

        <aside className="conversation-aside">
          <section className="card settings-card face-feedback" aria-label="Phản hồi theo nét mặt">
            <h2>Nét mặt hiện tại</h2>
            {settings.signLanguageCues !== false && (
              <FaceIllustration
                cue={faceCue}
                label={faceLabel}
                active={faceSourceActive}
                use3D={settings.expressionAvatar !== false}
                allowed3D={
                  faceIntervalMs === 200 && conversation.workload.rtf <= 0.8 && !signCardActive
                }
                colors={settings.captionColors !== false}
              />
            )}
            <HapticDisplay visual={haptics.visual} compact />
          </section>
          <section className="card sign-panel" aria-label="Ký hiệu câu nói">
            <h2>Ký hiệu câu nói</h2>
            {signs.selection ? (
              <SignPhraseCard
                key={`${signs.selection.id}:${signs.selection.phrase.id}`}
                phrase={signs.selection.phrase}
                onClose={signs.clear}
                onActive={setSignCardActive}
                onEnd={signs.end}
              />
            ) : (
              <div className="sign-empty" role="status">
                <p>
                  {sampleNotice ||
                    (conversation.record?.segments.length
                      ? 'Câu này chưa có mẫu ký hiệu.'
                      : 'Chờ câu tiếp theo')}
                </p>
                <small>Ký hiệu sẽ xuất hiện khi câu nói có mẫu phù hợp.</small>
              </div>
            )}
            <QuickPhrasePicker
              available={availableSigns}
              onSelectPhrase={(text) => {
                const phrase = findPlayableSignPhrase(text, availableSigns);
                if (phrase) {
                  setSampleNotice('');
                  signs.select(phrase);
                } else {
                  signs.clear();
                  setSampleNotice(`Chưa có mẫu ký hiệu cho câu “${text}”`);
                }
              }}
            />
          </section>
          <section className="card settings-card cue-panel">
            <details>
              <summary>Sắc thái câu vừa nói</summary>
              <h2>
                {latest?.label
                  ? expressionUI[latest.label].name
                  : latest
                    ? 'Chưa xác định'
                    : 'Đang chờ lời nói'}
              </h2>
              <p>
                {latest?.reason === 'conflict'
                  ? 'Các nguồn chưa thống nhất. Chưa kết luận cho câu này.'
                  : latest?.label
                    ? 'Gợi ý cho câu vừa nói. Đây không phải kết luận về cảm xúc thật.'
                    : !fusionEnabled
                      ? 'Đang dùng chế độ nhẹ; phụ đề và biểu cảm mặt vẫn hoạt động.'
                      : conversation.error
                        ? 'Gợi ý tổng hợp tạm dừng; phụ đề và biểu cảm mặt vẫn hoạt động.'
                        : !fusionReady
                          ? 'Gói phân tích câu chữ đang được chuẩn bị.'
                          : rejectedText?.reason === 'clipped-audio'
                            ? 'Âm thanh đầu vào bị méo; hãy giảm mức micro trong cài đặt thiết bị.'
                            : rejectedText
                              ? 'Câu chưa đủ rõ để gợi ý sắc thái. Phụ đề vẫn hoạt động.'
                              : segments.length
                                ? latest?.reason === 'low-score'
                                  ? 'Chưa có gợi ý rõ cho câu này.'
                                  : 'Chưa có gợi ý rõ cho câu này.'
                                : 'Kết quả xuất hiện sau khi người đối diện nói một câu.'}
              </p>
              <details>
                <summary>Điều kiện hình ảnh</summary>
                <p>{resultExplanation(camera.result)}</p>
                <p>Điểm model là gợi ý về biểu cảm, không xác định cảm xúc hay ý định.</p>
              </details>
            </details>
          </section>

          <section className="card settings-card session-options">
            <details
              open={optionsOpen}
              onToggle={(event) => setOptionsOpen(event.currentTarget.open)}
            >
              <summary>Tùy chọn</summary>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.signPhrasePlayback !== false}
                  disabled={!changeSettings}
                  onChange={(e) =>
                    changeSettings?.({ ...settings, signPhrasePlayback: e.target.checked })
                  }
                />
                <span>Tự hiện ký hiệu khi có mẫu</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.signLanguageCues !== false}
                  disabled={!changeSettings}
                  onChange={(event) =>
                    changeSettings?.({ ...settings, signLanguageCues: event.target.checked })
                  }
                />
                <span>Hiện minh họa nét mặt</span>
              </label>
              {runtimeProfile.id === 'pc-candidate' &&
                runtimeProfile.asr !== 'moonshine-streaming-vi-research' && (
                  <p className="fine-note">
                    Bản thử tốc độ PC: Gipformer và B0/WebGPU. Chưa nghiệm thu Android hoặc độ chính
                    xác hội thoại.
                  </p>
                )}
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.captionColors !== false}
                  disabled={!changeSettings}
                  onChange={(event) =>
                    changeSettings?.({ ...settings, captionColors: event.target.checked })
                  }
                />
                <span>Màu nhãn, viền và minh họa</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.expressionAvatar !== false}
                  disabled={!changeSettings}
                  onChange={(event) =>
                    changeSettings?.({ ...settings, expressionAvatar: event.target.checked })
                  }
                />
                <span>Minh họa nét mặt có chiều sâu</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={toneEnabled}
                  disabled={running || !aiReady}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setToneEnabled(enabled);
                    if (enabled) {
                      setFusionEnabled(true);
                      void conversation.prepareTone();
                    } else {
                      conversation.disableTone();
                      emitAudit('tone-disabled', { branch: 'voice', enabled: false });
                    }
                  }}
                />
                <span>Thử tone giọng trong tổng hợp · tải thêm khoảng 356 MiB</span>
              </label>
              {toneEnabled && (
                <p role="status">
                  {conversation.toneState === 'preparing'
                    ? 'Đang chuẩn bị tone trước phiên…'
                    : conversation.toneState === 'ready'
                      ? 'Tone đã sẵn sàng · chưa kiểm chứng chất lượng tiếng Việt.'
                      : 'Tone chưa sẵn sàng. Tắt rồi bật lại để thử chuẩn bị; cần thiết bị hỗ trợ GPU.'}
                </p>
              )}
              {toneEnabled && conversation.toneCached === false && (
                <p>
                  Chưa lưu được model tone vào cache. Phiên này vẫn chạy; lần sau có thể cần tải
                  lại.
                </p>
              )}
              <p>Ít nhất hai nguồn đủ chất lượng đồng thuận; nguồn mâu thuẫn thì chưa kết luận.</p>
              <p>Nhịp theo nét mặt đã ổn định; tổng hợp chỉ hiển thị gợi ý cho câu.</p>
              <label className="field">
                Mô hình phụ đề
                <select
                  aria-label="Mô hình phụ đề"
                  value={
                    runtimeProfile.id === 'pc-candidate'
                      ? runtimeProfile.asr
                      : moonshineNeedsLocalMode || moonshineRuntimeUnavailable
                        ? 'product'
                        : requestedProfile
                  }
                  disabled={runtimeProfile.id === 'pc-candidate' || running || !changeSettings}
                  onChange={(event) =>
                    changeSettings?.({
                      ...settings,
                      asrProfile: event.target.value as Settings['asrProfile'],
                    })
                  }
                >
                  <option value="product">PhoWhisper-tiny · mặc định</option>
                  {runtimeProfile.id === 'pc-candidate' && (
                    <option value="gipformer-research">Gipformer tiếng Việt · bản thử PC</option>
                  )}
                  <option value="moonshine-streaming-vi-research" disabled={!moonshineAvailable}>
                    {moonshineAvailable
                      ? 'Moonshine Streaming tiếng Việt · bản thử local'
                      : 'Moonshine Streaming tiếng Việt · chưa khả dụng ở bản này'}
                  </option>
                </select>
              </label>
              {moonshineNeedsLocalMode && (
                <p className="fine-note" role="status">
                  Moonshine chỉ chạy thử trên localhost với chế độ cô lập.{' '}
                  {isLocalMoonshineOrigin ? (
                    <a href="/?moonshine=1">Mở chế độ thử local</a>
                  ) : (
                    'Link chia sẻ hiện tại giữ nguyên PhoWhisper.'
                  )}
                </p>
              )}
              {moonshineRuntimeUnavailable && (
                <p className="fine-note" role="status">
                  Gói thử nghiệm chưa tương thích với runtime trên thiết bị. PhoWhisper tiếp tục
                  hoạt động.
                </p>
              )}
              {moonshineAvailable && (
                <p className="fine-note">
                  Model được chuẩn bị trước phiên; lần đầu tải khoảng 43 MiB. Chưa có benchmark
                  SignEmo.
                </p>
              )}
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={fusionEnabled}
                  disabled={running || !fusionReady}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    setFusionEnabled(enabled);
                    setRecoveryMode(false);
                    if (enabled) emitAudit('fusion-enabled', { enabled: true });
                  }}
                />
                <span>Thử gợi ý tổng hợp</span>
              </label>
              <details className="recent-activity">
                <summary>Hoạt động gần đây</summary>
                <ol>
                  {auditEvents.slice(0, 5).map((event) => (
                    <li key={event.id} className={`level-${event.level}`}>
                      <time dateTime={new Date(event.occurredAt).toISOString()}>
                        {new Intl.DateTimeFormat('vi-VN', { timeStyle: 'medium' }).format(
                          event.occurredAt,
                        )}
                      </time>{' '}
                      {auditMessage(event)}
                    </li>
                  ))}
                  {!auditEvents.length && <li>Chưa có hoạt động nào được ghi lại.</li>}
                </ol>
              </details>
            </details>
          </section>
        </aside>
      </div>

      {diagnosticsVisible && conversation.evidence.length > 0 && (
        <details className="diagnostics">
          <summary>Chi tiết tín hiệu của câu gần nhất</summary>
          {conversation.evidence.map((item) => (
            <p key={item.source}>
              {item.source} · {item.quality}
              {item.reason ? ` · ${item.reason}` : ''} ·{' '}
              {Object.entries(item.scores)
                .map(([label, score]) => `${label}: ${score.toFixed(2)}`)
                .join(' · ')}
            </p>
          ))}
          <p>Điểm model chưa được hiệu chỉnh thành xác suất cảm xúc thật.</p>
        </details>
      )}
      {diagnosticsVisible && (
        <details className="diagnostics">
          <summary>Hiệu năng và chất lượng tín hiệu</summary>
          <p>
            Camera AI: {Math.round(1000 / faceIntervalMs)} lần/giây · p95 gần đây{' '}
            {camera.getLiveP95().toFixed(0)} ms.
          </p>
          <p>
            ASR: RTF {conversation.workload.rtf.toFixed(2)} · hàng đợi{' '}
            {conversation.workload.pendingAsr} đoạn.
          </p>
          <p>
            Micro: khử nhiễu{' '}
            {noiseSuppression === 'on'
              ? 'bật'
              : noiseSuppression === 'off'
                ? 'tắt'
                : noiseSuppression === 'unsupported'
                  ? 'không được báo trạng thái'
                  : 'chưa kiểm tra'}
            , khử vọng{' '}
            {echoCancellation === 'on'
              ? 'bật'
              : echoCancellation === 'off'
                ? 'tắt'
                : echoCancellation === 'unsupported'
                  ? 'không được báo trạng thái'
                  : 'chưa kiểm tra'}
            .
          </p>
          <p>Đoạn thoại được chốt sau im lặng khoảng 0,54 giây hoặc tối đa 3 giây.</p>
        </details>
      )}
    </>
  );
}
