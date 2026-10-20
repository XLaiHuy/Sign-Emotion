import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';
import { vi } from 'vitest';
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
if (typeof window !== 'undefined') {
  window.scrollTo = vi.fn();
  HTMLMediaElement.prototype.play = vi.fn().mockImplementation(async () => {});
  HTMLMediaElement.prototype.pause = vi.fn().mockImplementation(() => {});
  HTMLMediaElement.prototype.load = vi.fn().mockImplementation(() => {});
}
