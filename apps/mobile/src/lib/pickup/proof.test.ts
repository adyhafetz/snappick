import { describe, expect, it } from 'vitest';
import { proofResize, stripJpegMetadata } from './proof-metadata';

describe('proof image minimization', () => {
  it('caps the long edge at 800px', () => {
    expect(proofResize(1600, 900)).toEqual({ width: 800 });
    expect(proofResize(600, 900)).toEqual({ height: 800 });
    expect(proofResize(800, 600)).toBeUndefined();
  });
  it('removes APP1 and APP13 metadata segments while preserving image bytes', () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0, 4, 1, 2, 0xff, 0xdb, 0, 3, 9, 0xff, 0xda, 7, 8, 0xff, 0xd9]);
    expect(Array.from(stripJpegMetadata(jpeg))).toEqual([0xff, 0xd8, 0xff, 0xdb, 0, 3, 9, 0xff, 0xda, 7, 8, 0xff, 0xd9]);
  });
});
