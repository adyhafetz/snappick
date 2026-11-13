import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from './sha256';

const enc = (s: string) => new TextEncoder().encode(s);

describe('sha256Hex', () => {
  it('matches the standard test vectors', () => {
    expect(sha256Hex(enc(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex(enc('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('matches Node crypto at every padding boundary and for a model-sized buffer', () => {
    for (const n of [55, 56, 63, 64, 65, 119, 120, 128, 1000]) {
      const bytes = new Uint8Array(n).map((_, i) => (i * 31 + 7) & 0xff);
      expect(sha256Hex(bytes)).toBe(createHash('sha256').update(bytes).digest('hex'));
    }
    const big = new Uint8Array(3_000_000).map((_, i) => (i * 131) & 0xff);
    expect(sha256Hex(big)).toBe(createHash('sha256').update(big).digest('hex'));
  });
});
