import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { fromByteArray, toByteArray } from 'base64-js';
import { proofResize, stripJpegMetadata } from './proof-metadata';

export async function prepareProofImage(uri: string, width: number, height: number) {
  const resize = proofResize(width, height);
  const result = await manipulateAsync(uri, resize ? [{ resize }] : [], { compress: 0.65, format: SaveFormat.JPEG, base64: true });
  if (!result.base64) throw new Error('The proof photo could not be prepared.');
  return { ...result, base64: fromByteArray(stripJpegMetadata(toByteArray(result.base64))), quality: 0.65, exifStripped: true };
}

