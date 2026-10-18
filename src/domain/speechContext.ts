import type { TranscriptSegment } from './conversation';

/** Hard ASR cuts are not sentence boundaries. Keep at most two preceding chunks. */
export class SpeechContext {
  private chunks: TranscriptSegment[] = [];
  private utteranceId = '';
  private truncated = false;
  accept(segment: TranscriptSegment): TranscriptSegment | null {
    const id = segment.utteranceId ?? segment.id;
    if (id !== this.utteranceId) {
      this.chunks = [];
      this.truncated = false;
      this.utteranceId = id;
    }
    const context = [...this.chunks, segment];
    if (segment.boundary === 'limit') {
      this.chunks.push(segment);
      if (this.chunks.length > 2) {
        this.chunks.shift();
        this.truncated = true;
      }
      return null;
    }
    this.chunks = [];
    this.utteranceId = '';
    if (this.truncated) {
      this.truncated = false;
      return null;
    }
    return {
      ...segment,
      startMs: context[0].startMs,
      text: context.map((item) => item.text).join(' '),
    };
  }
  reset() {
    this.chunks = [];
    this.utteranceId = '';
    this.truncated = false;
  }
}
