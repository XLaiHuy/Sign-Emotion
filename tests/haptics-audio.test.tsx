import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHaptics } from '../src/features/practice/useHaptics';
const originalVibrate = Object.getOwnPropertyDescriptor(navigator, 'vibrate');

class FakeAudioContext {
  static instance: FakeAudioContext | null = null;
  currentTime = 0;
  state: AudioContextState = 'running';
  destination = {} as AudioDestinationNode;
  oscillators: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];
  constructor() {
    FakeAudioContext.instance = this;
  }
  createOscillator() {
    const oscillator = {
      type: 'sine',
      frequency: { value: 0 },
      connect: (node: unknown) => node,
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
      onended: null as (() => void) | null,
    };
    this.oscillators.push(oscillator);
    return oscillator as unknown as OscillatorNode;
  }
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: (node: unknown) => node,
      disconnect: vi.fn(),
    } as unknown as GainNode;
  }
  resume = vi.fn(async () => {
    this.state = 'running';
  });
  close = vi.fn(async () => {
    this.state = 'closed';
  });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (originalVibrate) Object.defineProperty(navigator, 'vibrate', originalVibrate);
  else Reflect.deleteProperty(navigator, 'vibrate');
});

describe('PC rhythm fallback', () => {
  it('closes audio on release/pagehide and only reopens after a new gesture', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { result } = renderHook(() => useHaptics('auto', true));
    await act(async () => {
      await result.current.unlock();
    });
    const first = FakeAudioContext.instance!;
    act(() => result.current.release());
    expect(first.close).toHaveBeenCalledOnce();
    expect(result.current.audioState).toBe('locked');
    await act(async () => {
      await result.current.testSound();
    });
    const second = FakeAudioContext.instance!;
    expect(second).not.toBe(first);
    act(() => window.dispatchEvent(new Event('pagehide')));
    expect(second.close).toHaveBeenCalledOnce();
    expect(result.current.audioState).toBe('locked');
  });
  it('does not revive playback when a pending audio resume resolves after pagehide', async () => {
    let finishResume!: () => void;
    class DelayedContext extends FakeAudioContext {
      state: AudioContextState = 'suspended';
      resume = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishResume = resolve;
          }),
      );
    }
    vi.stubGlobal('AudioContext', DelayedContext);
    const { result } = renderHook(() => useHaptics('auto', true));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.testSound();
    });
    const context = FakeAudioContext.instance!;
    act(() => window.dispatchEvent(new Event('pagehide')));
    await act(async () => {
      finishResume();
      await pending;
    });
    expect(context.close).toHaveBeenCalledOnce();
    expect(context.oscillators).toHaveLength(0);
    expect(result.current.audioState).toBe('locked');
  });
  it('uses audio on desktop even when the Vibration API accepts requests', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
    const { result } = renderHook(() => useHaptics('auto', true));
    await act(async () => {
      await result.current.playFromGesture('happy');
    });
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.visual.output).toBe('audio');
    expect(vibrate).not.toHaveBeenCalled();
    expect(FakeAudioContext.instance?.oscillators.at(-1)?.stop).toHaveBeenCalledWith(0.24);
  });
  it('reports blocked audio as visual instead of claiming audio played', async () => {
    class BlockedAudioContext extends FakeAudioContext {
      state: AudioContextState = 'suspended';
      resume = vi.fn(async () => {
        throw new Error('blocked');
      });
    }
    vi.useFakeTimers();
    vi.stubGlobal('AudioContext', BlockedAudioContext);
    const { result } = renderHook(() => useHaptics('auto', true));
    await act(async () => {
      await result.current.playFromGesture('sad');
    });
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.visual.output).toBe('visual');
    expect(result.current.audioState).toBe('error');
    expect(FakeAudioContext.instance?.oscillators).toHaveLength(0);
  });
  it('keeps a muted rhythm visual and cancels all timers on background', () => {
    vi.useFakeTimers();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    FakeAudioContext.instance = null;
    const { result } = renderHook(() => useHaptics('auto', false));
    act(() => {
      expect(result.current.play('angry')?.output).toBe('visual');
    });
    expect(FakeAudioContext.instance).toBeNull();
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(vi.getTimerCount()).toBe(0);
    expect(result.current.visual.playing).toBe(false);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });
  it('plays a local tone when vibration is unavailable and reports the output accurately', () => {
    vi.useFakeTimers();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const vibrate = vi.fn(() => false);
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
    const { result, unmount } = renderHook(() => useHaptics('auto', true));
    let event: ReturnType<typeof result.current.play> = null;

    act(() => {
      event = result.current.play('sad', 'practice');
      vi.advanceTimersByTime(0);
    });

    expect(vibrate).not.toHaveBeenCalled();
    expect((event as ReturnType<typeof result.current.play>)?.output).toBe('audio');
    expect((event as ReturnType<typeof result.current.play>)?.apiAccepted).toBe(false);
    expect(FakeAudioContext.instance?.oscillators).toHaveLength(1);
    expect(FakeAudioContext.instance?.oscillators[0].start).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('does not emit sound or vibration for a neutral result', () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
    const { result } = renderHook(() => useHaptics('auto', true));

    act(() => {
      expect(result.current.play('neutral')).toBeNull();
    });

    expect(vibrate).not.toHaveBeenCalled();
  });
});
