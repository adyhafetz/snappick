import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { fromByteArray, toByteArray } from 'base64-js';
import { proofResize, stripJpegMetadata } from '@/lib/pickup/proof-metadata';
import { supabase } from '@/lib/supabase';

export interface PreparedScanImage {
  uri: string;
  width: number;
  height: number;
  base64: string;
  bytes: Uint8Array;
}

/**
 * Prepares a scan photo for upload:
 * - Downsamples so that max dimension <= 800px.
 * - Compresses to JPEG quality 0.65.
 * - Strips all EXIF / GPS / metadata markers.
 */
export async function prepareScanImage(
  uri: string,
  width: number,
  height: number
): Promise<PreparedScanImage> {
  const resize = proofResize(width, height, 800);
  const result = await manipulateAsync(uri, resize ? [{ resize }] : [], {
    compress: 0.65,
    format: SaveFormat.JPEG,
    base64: true,
  });

  if (!result.base64) {
    throw new Error('Scan photo could not be encoded for upload.');
  }

  const rawBytes = toByteArray(result.base64);
  const strippedBytes = stripJpegMetadata(rawBytes);
  const cleanedBase64 = fromByteArray(strippedBytes);

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    base64: cleanedBase64,
    bytes: strippedBytes,
  };
}

/**
 * Uploads a prepared scan image to the private 'scans' bucket
 * and registers the image path on the scan record.
 */
export async function uploadScanImage(
  userId: string,
  scanId: string,
  imageBytes: Uint8Array
): Promise<string> {
  const filePath = `${userId}/${scanId}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('scans')
    .upload(filePath, imageBytes, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Failed to upload scan image: ${uploadError.message}`);
  }

  // Update image_path on scans row via set_scan_image_path RPC
  const { error: rpcError } = await supabase.rpc('set_scan_image_path', {
    p_scan_id: scanId,
    p_image_path: filePath,
  });

  if (rpcError) {
    // Non-fatal if scan record update fails, but log/bubble
    console.warn('Could not set image path on scan:', rpcError.message);
  }

  return filePath;
}

