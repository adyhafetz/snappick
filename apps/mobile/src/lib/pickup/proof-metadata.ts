export function proofResize(width: number, height: number, max = 800) {
  if (width <= max && height <= max) return undefined;
  return width >= height ? { width: max } : { height: max };
}

export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const output: number[] = [0xff, 0xd8];
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) { output.push(...bytes.slice(offset)); break; }
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) { output.push(...bytes.slice(offset)); break; }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2 || offset + 2 + length > bytes.length) { output.push(...bytes.slice(offset)); break; }
    const isMetadata = marker === 0xe1 || marker === 0xed || marker === 0xee;
    if (!isMetadata) output.push(...bytes.slice(offset, offset + 2 + length));
    offset += 2 + length;
  }
  return Uint8Array.from(output);
}

/** A proof photo must have been taken within this window (the server enforces the same limit). */
export const PROOF_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const PROOF_CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * Camera photos are captured "now". Gallery photos use their own EXIF timestamp
 * (local time, "YYYY:MM:DD HH:MM:SS"); returns null when it cannot be read so the
 * caller can refuse the photo instead of guessing.
 */
export function proofCapturedAt(
  source: 'camera' | 'gallery',
  exif?: Record<string, unknown> | null,
  now: Date = new Date()
): Date | null {
  if (source === 'camera') return now;
  const raw = exif?.DateTimeOriginal ?? exif?.DateTimeDigitized ?? exif?.DateTime;
  if (typeof raw !== 'string') return null;
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match.map(Number) as unknown as number[];
  const parsed = new Date(y, mo - 1, d, h, mi, s);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isProofFresh(capturedAt: Date, now: Date = new Date()): boolean {
  const age = now.getTime() - capturedAt.getTime();
  return age >= -PROOF_CLOCK_SKEW_MS && age <= PROOF_MAX_AGE_MS;
}
