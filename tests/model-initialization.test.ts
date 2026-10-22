import { expect, it, vi } from 'vitest';
import {
  ModelInitializationError,
  modelInitializationCode,
  modelInitializationMessage,
  workerInitializationCode,
} from '../src/domain/modelInitialization';
import { makeWorkerReady } from '../src/infrastructure/inference/workerReady';
import { auditMessage } from '../src/domain/audit';

it('projects errors to fixed codes and copy without forwarding arbitrary exception text', () => {
  expect(modelInitializationCode(new ModelInitializationError('gpu'))).toBe('gpu');
  expect(modelInitializationCode(new DOMException('private filename', 'QuotaExceededError'))).toBe(
    'storage',
  );
  expect(modelInitializationCode(new TypeError('Failed to fetch private URL'))).toBe('network');
  expect(modelInitializationCode(new Error('WebAssembly code generation disallowed'))).toBe('wasm');
  expect(workerInitializationCode('private transcript')).toBe('worker');
  expect(workerInitializationCode('missing-assets')).toBe('missing-assets');
  expect(modelInitializationMessage('assets', 'missing-assets')).toContain('máy chủ đang thiếu');
  expect(modelInitializationMessage('assets', 'missing-assets')).not.toContain('Mất kết nối');
  expect(
    auditMessage({
      code: 'ai-preparation-failed',
      details: { branch: 'face', reason: 'unsupported-browser' },
    }),
  ).toContain('nhận diện khuôn mặt');
  expect(modelInitializationMessage('speech', 'timeout')).toContain('phụ đề tiếng Việt');
  expect(
    modelInitializationMessage('face', modelInitializationCode(new Error('private content'))),
  ).not.toContain('private');
});

it('preserves safe worker codes, cleans listeners and handles slow initialization deadlines', async () => {
  vi.useFakeTimers();
  class LocalWorker extends EventTarget {
    postMessage() {}
  }
  const worker = new LocalWorker() as unknown as Worker;
  try {
    const typed = makeWorkerReady(worker, { type: 'init' });
    worker.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'error', code: 'gpu', message: 'private exception' },
      }),
    );
    await expect(typed).rejects.toMatchObject({ code: 'gpu', message: 'gpu' });
    expect(vi.getTimerCount()).toBe(0);
    const timeout = makeWorkerReady(worker, { type: 'init' });
    const rejected = expect(timeout).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(120000);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
