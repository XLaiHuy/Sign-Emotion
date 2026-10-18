import { describe, expect, it } from 'vitest';
import { verifyBytes } from '../src/infrastructure/offline/assets';

const bytes = new TextEncoder().encode('test');
const asset = {
  url: '/models/fixture.bin',
  bytes: 4,
  sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  source: 'test fixture',
  license: 'MIT',
};

describe('verifyBytes', () => {
  it('accepts a complete buffer with the manifest checksum', async () => {
    await expect(verifyBytes(bytes.buffer, asset)).resolves.toBeUndefined();
  });

  it('rejects a buffer whose byte count differs from the manifest', async () => {
    await expect(verifyBytes(new TextEncoder().encode('too long').buffer, asset)).rejects.toThrow(
      'Tài nguyên chưa tải đầy đủ',
    );
  });

  it('rejects a same-size buffer with the wrong checksum', async () => {
    await expect(verifyBytes(new TextEncoder().encode('fail').buffer, asset)).rejects.toThrow(
      'Tài nguyên không khớp checksum',
    );
  });
});
