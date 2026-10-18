import { afterEach, expect, it, vi } from 'vitest';
import { MicrophoneCapture } from '../src/infrastructure/media/microphone';

afterEach(() => vi.unstubAllGlobals());
function setup(addModule = vi.fn(async () => {})) {
  const track = { stop: vi.fn(), addEventListener: vi.fn() };
  const stream = {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
  const connect = vi.fn().mockReturnThis();
  const context = {
    state: 'running',
    audioWorklet: { addModule },
    destination: {},
    createBiquadFilter: () => ({ type: '', frequency: { value: 0 }, Q: { value: 0 }, connect }),
    createGain: () => ({ gain: { value: 1 }, connect }),
    createMediaStreamSource: () => ({ connect }),
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {
      context.state = 'closed';
    }),
  };
  const getUserMedia = vi.fn();
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  const makeContext = vi.fn();
  vi.stubGlobal('AudioContext', makeContext);
  vi.stubGlobal(
    'AudioWorkletNode',
    class {
      port = { onmessage: null };
      connect = connect;
      disconnect = vi.fn();
    },
  );
  return { stream, track, context: context as unknown as AudioContext, getUserMedia, makeContext };
}
it('uses the click-activated context and supplied stream without requesting another permission', async () => {
  const { stream, track, context, getUserMedia, makeContext } = setup();
  const capture = new MicrophoneCapture();
  await expect(capture.start(vi.fn(), vi.fn(), stream, context)).resolves.toBe(true);
  expect(getUserMedia).not.toHaveBeenCalled();
  expect(makeContext).not.toHaveBeenCalled();
  capture.stop();
  expect(track.stop).toHaveBeenCalled();
  expect(context.close).toHaveBeenCalled();
});
it('cancels while the AudioWorklet loads and never resumes a closed context', async () => {
  let resolve!: () => void;
  const { stream, track, context } = setup(
    vi.fn(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    ),
  );
  const capture = new MicrophoneCapture();
  const start = capture.start(vi.fn(), vi.fn(), stream, context);
  capture.stop();
  resolve();
  await expect(start).resolves.toBe(false);
  expect(context.resume).not.toHaveBeenCalled();
  expect(track.stop).toHaveBeenCalled();
  expect(context.close).toHaveBeenCalled();
});
