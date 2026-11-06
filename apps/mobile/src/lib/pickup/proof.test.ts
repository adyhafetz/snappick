import { describe, expect, it } from 'vitest';
import { proofResize, stripJpegMetadata , isProofFresh, proofCapturedAt } from './proof-metadata';


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

describe('proof capture time', () => {
  const now = new Date(2026, 10, 5, 19, 0, 0);

  it('uses the current time for camera photos', () => {
    expect(proofCapturedAt('camera', null, now)).toEqual(now);
  });

  it('reads the EXIF timestamp for gallery photos', () => {
    const captured = proofCapturedAt('gallery', { DateTimeOriginal: '2026:11:05 18:30:00' }, now);
    expect(captured).toEqual(new Date(2026, 10, 5, 18, 30, 0));
  });

  it('returns null when a gallery photo has no readable timestamp', () => {
    expect(proofCapturedAt('gallery', null, now)).toBeNull();
    expect(proofCapturedAt('gallery', { DateTimeOriginal: 'garbage' }, now)).toBeNull();
  });

  it('accepts recent photos and rejects old or future ones', () => {
    expect(isProofFresh(new Date(2026, 10, 5, 18, 0, 0), now)).toBe(true);
    expect(isProofFresh(new Date(2026, 9, 3, 13, 51, 0), now)).toBe(false);
    expect(isProofFresh(new Date(2026, 10, 5, 19, 30, 0), now)).toBe(false);
  });
});
