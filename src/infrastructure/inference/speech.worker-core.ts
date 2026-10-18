/// <reference lib="webworker" />
import { createSpeechAdapter } from './asr-adapter';
import type { AsrAdapter, AsrProfileId, AsrRequest } from '../../domain/asr';
import { modelInitializationCode } from '../../domain/modelInitialization';

const BASE_PROFILES = ['product', 'phowhisper', 'whisper-baseline', 'gipformer-research'];

export function installSpeechWorker(
  allowMoonshine: boolean,
  disposeChildren: () => void = () => {},
) {
  let adapter: AsrAdapter | null = null;
  let busy = false;
  let generation = 0;

  self.onmessage = async (event) => {
    const message = event.data;
    if (message.type === 'reset' || message.type === 'dispose') {
      generation++;
      try {
        adapter?.reset();
        if (message.type === 'dispose') {
          await adapter?.dispose();
          adapter = null;
        }
      } finally {
        if (message.type === 'dispose') {
          disposeChildren();
          self.postMessage({ type: 'disposed' });
          // Close from the owning event loop as well as the parent's terminate().
          // Streaming WASM pthread teardown can otherwise leave the parent target alive.
          if (allowMoonshine) self.close();
        }
      }
      return;
    }
    const current = generation;
    if (busy) {
      self.postMessage({ type: 'error', message: 'ASR đang xử lý một tác vụ khác.' });
      return;
    }
    try {
      busy = true;
      if (message.type === 'init') {
        await adapter?.dispose();
        const profile = (message.profile ?? 'product') as AsrProfileId;
        const isAllowed =
          BASE_PROFILES.includes(profile) ||
          (allowMoonshine && profile === 'moonshine-streaming-vi-research');
        if (!isAllowed) throw new Error('Unknown profile');
        adapter = createSpeechAdapter(profile);
        const ready = await adapter.prepare();
        if (generation === current) self.postMessage({ type: 'ready', ...ready });
      } else if ((message.type === 'transcribe' || message.type === 'interim') && adapter) {
        const segment = await adapter.acceptPcm(
          message as AsrRequest,
          message.type === 'transcribe',
        );
        if (generation === current)
          self.postMessage({
            type: message.type === 'interim' ? 'partial' : 'result',
            segment,
            revision: message.revision,
          });
      }
    } catch (error) {
      if (message.type === 'init') disposeChildren();
      if (generation === current)
        self.postMessage({
          type: 'error',
          code: modelInitializationCode(error),
          message: 'Không chạy được phụ đề local. Kiểm tra profile và tài nguyên trên thiết bị.',
        });
    } finally {
      busy = false;
    }
  };
}
