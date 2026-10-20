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
