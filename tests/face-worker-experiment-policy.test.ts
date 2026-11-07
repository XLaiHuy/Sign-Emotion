import { afterEach, expect, it, vi } from 'vitest';

vi.mock('@mediapipe/tasks-vision', () => ({ FaceLandmarker: {}, FilesetResolver: {} }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
it('rejects forged non-local experimental init in the worker before model/network work', async () => {
  const postMessage = vi.fn();
  const workerSelf = {
    location: { hostname: 'sign-emotion.vercel.app' },
    postMessage,
    onmessage: null as null | ((event: MessageEvent) => Promise<void>),
  };
  vi.stubGlobal('self', workerSelf);
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      getContext() {
        return {};
      }
    },
  );
  await import('../src/infrastructure/inference/face.worker');
  for (const faceExperiment of ['eye-crop', 'low-light', 'detector-050', 'expression-050']) {
    await workerSelf.onmessage!(
      new MessageEvent('message', { data: { type: 'init', research: true, faceExperiment } }),
    );
    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'error', message: expect.stringContaining('localhost') }),
    );
  }
});
