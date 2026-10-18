import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it('advances PCM time through empty input quanta and retains real samples on reconnect', async () => {
  vi.stubGlobal('sampleRate', 48000);
  vi.stubGlobal('currentFrame', 0);
  vi.stubGlobal(
    'AudioWorkletProcessor',
    class {
      port = { postMessage: vi.fn() };
    },
  );
  const register = vi.fn();
  vi.stubGlobal('registerProcessor', register);
  await import('../src/infrastructure/media/capture.worklet');
  const Processor = register.mock.calls[0][1];
  const processor = new Processor();
  const output = [[new Float32Array(128)]];
  for (let index = 0; index < 120; index++) {
    vi.stubGlobal('currentFrame', index * 128);
    processor.process([[]], output);
  }
  const quiet = processor.port.postMessage.mock.calls.map((call: any[]) => call[0]);
  expect(quiet.length).toBeGreaterThanOrEqual(9);
  expect(
    quiet.every(
      (message: any) =>
        message.samples.length === 512 && message.samples.every((value: number) => value === 0),
    ),
  ).toBe(true);
  for (let index = 120; index < 240; index++) {
    vi.stubGlobal('currentFrame', index * 128);
    processor.process([[new Float32Array(128).fill(0.1)]], output);
  }
  const all = processor.port.postMessage.mock.calls.map((call: any[]) => call[0]);
  expect(all.some((message: any) => message.samples.some((value: number) => value > 0.05))).toBe(
    true,
  );
  for (let index = 0; index < all.length; index++) {
    expect(all[index].offset).toBe(index * 512);
    if (index > 0)
      expect(all[index].contextEndSeconds).toBeGreaterThan(all[index - 1].contextEndSeconds);
  }
});
