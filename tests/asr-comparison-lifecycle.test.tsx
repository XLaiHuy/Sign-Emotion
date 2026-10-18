import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AsrComparison } from '../src/features/lab/AsrComparison';
vi.mock('../src/infrastructure/inference/asr-comparison.worker.ts?worker&url', () => ({
  default: '/comparison.js',
}));
vi.mock('../src/infrastructure/media/decodeLocalAudio', () => ({
  decodeLocalAudio: vi.fn(async () => new Float32Array(4800)),
}));
vi.mock('../src/infrastructure/audit/log', () => ({ emitAudit: vi.fn() }));
const instances: FakeWorker[] = [];
class FakeWorker {
  onmessage?: (event: { data: unknown }) => void;
  onerror?: () => void;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() {
    instances.push(this);
  }
}
afterEach(() => {
  cleanup();
  instances.length = 0;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function start() {
  vi.stubGlobal('Worker', FakeWorker);
  const onBusy = vi.fn();
  const view = render(
    <AsrComparison
      file={new File(['fixture'], 'test.wav')}
      reference=""
      disabled={false}
      onBusy={onBusy}
    />,
  );
  view.container.querySelector('details')!.open = true;
  fireEvent.click(screen.getByRole('button', { name: 'So sánh PhoWhisper và Gipformer' }));
  await waitFor(() => expect(instances[0]?.postMessage).toHaveBeenCalledOnce());
  return { ...view, onBusy, worker: instances[0] };
}
it('terminates the owned worker on cancel and ignores its late result', async () => {
  const { worker, onBusy } = await start();
  fireEvent.click(screen.getByRole('button', { name: 'Hủy so sánh ASR' }));
  worker.onmessage?.({
    data: { type: 'result', rows: [{ profile: 'phowhisper', status: 'ok', text: 'stale result' }] },
  });
  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(onBusy).toHaveBeenLastCalledWith(false);
  expect(screen.queryByText('stale result')).toBeNull();
});
it('terminates the owned worker when hidden and does not keep it after unmount', async () => {
  const { worker, unmount, onBusy } = await start();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  fireEvent(document, new Event('visibilitychange'));
  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(onBusy).toHaveBeenLastCalledWith(false);
  unmount();
  expect(worker.terminate).toHaveBeenCalledOnce();
});
