import { Directory, File, Paths } from 'expo-file-system';
import { sha256Hex } from './sha256';

/**
 * Downloaded detector models live in the app's document folder (kept until the app removes them), so a model is
 * downloaded once, works offline, and does not depend on a download link that expires.
 */
function modelsDir(): Directory {
  return new Directory(Paths.document, 'models');
}

/** Downloads a model, checks it against the registered SHA-256 (when there is one) and returns its local URI. */
export async function downloadVerifiedModel(url: string, version: string, sha256?: string | null): Promise<string> {
  const dir = modelsDir();
  dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, `waste_detector_${version.replace(/[^A-Za-z0-9._-]/g, '_')}.tflite`);
  if (target.exists) target.delete();
  const file = await File.downloadFileAsync(url, target, { idempotent: true });
  if (sha256) {
    const actual = sha256Hex(new Uint8Array(await file.arrayBuffer()));
    if (actual !== sha256.trim().toLowerCase()) {
      file.delete();
      throw new Error(`Downloaded model ${version} does not match its checksum.`);
    }
  }
  return file.uri;
}

/** Removes downloaded models, except the one at `keepUri`. */
export function deleteDownloadedModels(keepUri?: string): void {
  const dir = modelsDir();
  if (!dir.exists) return;
  for (const entry of dir.list()) {
    if (entry instanceof File && entry.uri !== keepUri) entry.delete();
  }
}
