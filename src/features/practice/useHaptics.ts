import { useCallback, useEffect, useRef, useState } from 'react';
import {
  expressionUI,
  type Expression,
  type HapticEvent,
  type HapticMode,
} from '../../shared/contracts';

export interface HapticVisual {
  active: boolean;
  playing: boolean;
  index: number;
  pattern: number[];
  label: Expression | null;
  apiAccepted: boolean;
  output: HapticEvent['output'] | null;
}

const idle: HapticVisual = {
  active: false,
  playing: false,
  index: -1,
  pattern: [],
  label: null,
  apiAccepted: false,
  output: null,
};

export function useHaptics(mode: HapticMode, soundFeedback = false) {
  const [visual, setVisual] = useState<HapticVisual>(idle);
  const [audioState, setAudioState] = useState<'locked' | 'ready' | 'error'>('locked');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const oscillators = useRef(new Set<OscillatorNode>());
  const audio = useRef<AudioContext | null>(null);
  const motorActive = useRef(false);
  const playbackGeneration = useRef(0);
  const mounted = useRef(true);

  const unlock = useCallback(async () => {
    if (!mounted.current || document.hidden) return false;
    let context: AudioContext | null = null;
    try {
      audio.current ??= new AudioContext();
      context = audio.current;
      if (context.state === 'suspended') await context.resume();
      if (audio.current !== context || !mounted.current) return false;
      const ready = context.state === 'running';
      if (audio.current === context) setAudioState(ready ? 'ready' : 'locked');
      return ready;
    } catch {
      if (mounted.current && audio.current === context) setAudioState('error');
      return false;
    }
  }, []);

  const cancel = useCallback(() => {
    playbackGeneration.current++;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    for (const oscillator of oscillators.current) {
      try {
        oscillator.stop();
      } catch {
        /* already stopped */
      }
    }
    oscillators.current.clear();
    if (motorActive.current)
      try {
        navigator.vibrate?.(0);
      } catch {
        /* no motor */
      }
    motorActive.current = false;
    setVisual(idle);
  }, []);

  const release = useCallback(() => {
    cancel();
    const context = audio.current;
    audio.current = null;
    if (mounted.current) setAudioState('locked');
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }, [cancel]);

  const tone = useCallback((context: AudioContext, durationMs: number) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime;
    const length = durationMs / 1000;
    oscillator.type = 'sine';
    oscillator.frequency.value = 520;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.045, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    oscillator.connect(gain).connect(context.destination);
    oscillators.current.add(oscillator);
    oscillator.onended = () => {
      oscillators.current.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + length);
  }, []);

  const play = useCallback(
    (label: Expression, reason: HapticEvent['reason'] = 'stable-change'): HapticEvent | null => {
      cancel();
      if (!mounted.current || label === 'neutral' || mode === 'off' || document.hidden) return null;
      const pattern = expressionUI[label].pattern;
      let apiAccepted = false;
      // Desktop Chrome can expose vibrate() and accept requests without a motor.
      const mobile =
        (navigator as Navigator & { userAgentData?: { mobile: boolean } }).userAgentData?.mobile ??
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (mode === 'auto' && mobile)
        try {
          apiAccepted = navigator.vibrate?.(pattern) ?? false;
        } catch {
          /* continue with audio fallback */
        }
      const wantsAudio = mode === 'auto' && !apiAccepted && soundFeedback;
      if (wantsAudio && audio.current?.state !== 'running') void unlock();
      const context = wantsAudio && audio.current?.state === 'running' ? audio.current : null;
      const output: HapticEvent['output'] = apiAccepted
        ? 'vibration'
        : context
          ? 'audio'
          : 'visual';
      motorActive.current = apiAccepted;
      const event: HapticEvent = {
        expression: label,
        timestamp: performance.now(),
        reason,
        apiAccepted,
        visual: true,
        output,
      };
      let at = 0;
      pattern.forEach((duration, index) => {
        timers.current.push(
          setTimeout(() => {
            setVisual({
              active: index % 2 === 0,
              playing: true,
              index,
              pattern,
              label,
              apiAccepted,
              output,
            });
            if (index % 2 === 0 && output === 'audio' && context) tone(context, duration);
          }, at),
        );
        at += duration;
      });
      timers.current.push(
        setTimeout(() => {
          motorActive.current = false;
          setVisual((v) => ({ ...v, active: false, playing: false, index: -1 }));
        }, at),
      );
      return event;
    },
    [cancel, mode, soundFeedback, tone, unlock],
  );

  useEffect(() => {
    mounted.current = true;
    setAudioState('locked');
    cancel();
    const hide = () => {
      if (document.hidden) release();
    };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', release);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', release);
      release();
    };
  }, [cancel, release]);
  useEffect(() => {
    if (mode !== 'auto' || !soundFeedback) release();
    else cancel();
  }, [cancel, release, mode, soundFeedback]);

  const testSound = useCallback(async () => {
    const generation = playbackGeneration.current;
    if (
      !(await unlock()) ||
      document.hidden ||
      !mounted.current ||
      generation !== playbackGeneration.current
    )
      return;
    cancel();
    if (audio.current?.state === 'running') tone(audio.current, 160);
  }, [cancel, tone, unlock]);

  const playFromGesture = useCallback(
    async (label: Expression, reason: HapticEvent['reason'] = 'practice') => {
      const generation = playbackGeneration.current;
      if (mode === 'auto' && soundFeedback) await unlock();
      if (generation !== playbackGeneration.current || !mounted.current) return null;
      return play(label, reason);
    },
    [mode, soundFeedback, unlock, play],
  );

  return { visual, play, playFromGesture, cancel, release, unlock, testSound, audioState };
}
