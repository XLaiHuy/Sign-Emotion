/// <reference lib="webworker" />
import { EmotionProvider } from './emotion-provider';
import { ProsodyProvider, type ProsodyArtifact } from './prosody-model';
import type { ModalityEvidence } from '../../domain/conversation';
const provider = new EmotionProvider();
let voice: ProsodyProvider | null = null;
let textReady = false;
let busy = false;
self.onmessage = async (event) => {
  const message = event.data;
  try {
    if (message.type === 'init') {
      if (message.text !== false) {
        try {
          await provider.initialize();
          textReady = true;
        } catch {
          await provider.dispose();
          self.postMessage({ type: 'branch-warning', branch: 'text' });
        }
      }
      if (message.prosody && message.research === true) {
        const candidate = new ProsodyProvider(message.prosody as ProsodyArtifact);
        try {
          await candidate.prepare();
          voice = candidate;
        } catch {
          await candidate.dispose();
          self.postMessage({ type: 'branch-warning', branch: 'voice' });
        }
      }
      if (!textReady && !voice) throw new Error('No context model');
      self.postMessage({ type: 'ready', textAvailable: textReady, voiceAvailable: Boolean(voice) });
    }
    if (message.type === 'infer') {
      if (busy) throw new Error('Overlapping emotion inference');
      busy = true;
      const started = performance.now();
      const evidence: ModalityEvidence[] = [];
      if (textReady) {
        try {
          evidence.push(
            ...(await provider.infer(
              message.text,
              message.startMs,
              message.endMs,
              message.quality,
            )),
          );
        } catch {
          textReady = false;
          await provider.dispose();
          self.postMessage({ type: 'branch-warning', branch: 'text' });
        }
      }
      if (voice) {
        try {
          evidence.push(
            await voice.infer(message.prosody, message.startMs, message.endMs, message.quality),
          );
        } catch {
          await voice.dispose();
          voice = null;
          self.postMessage({ type: 'branch-warning', branch: 'voice' });
        }
      }
      self.postMessage({
        type: 'result',
        id: message.id,
        evidence: evidence.map((item) => ({ ...item, segmentId: message.id })),
        processingMs: performance.now() - started,
      });
      busy = false;
    }
  } catch {
    busy = false;
    self.postMessage({
      type: 'error',
      message: 'Nhánh sắc thái chưa chạy được. Phụ đề vẫn tiếp tục.',
    });
  }
};
