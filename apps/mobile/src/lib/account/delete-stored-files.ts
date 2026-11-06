import { supabase } from '@/lib/supabase';

/** Buckets that hold a user's own files under a folder named after their user id. */
const USER_BUCKETS = ['scans', 'proofs'] as const;
const PAGE = 100;
const MAX_DEPTH = 3;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function listFiles(bucket: string, prefix: string, depth = 0): Promise<string[]> {
  const files: string[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: PAGE, offset });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const path = `${prefix}/${entry.name}`;
      // Folders have no id; recurse into them (proofs are stored as <user>/<request>/<file>).
      if (entry.id === null) {
        if (depth < MAX_DEPTH) files.push(...(await listFiles(bucket, path, depth + 1)));
      } else {
        files.push(path);
      }
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return files;
}

/**
 * Removes every scan photo and proof photo the signed-in user uploaded. Database rows are removed
 * by delete_user_account, but deleting an account does not delete the files in storage, so this
 * must run first (while the user can still authenticate). Throws if any file cannot be removed.
 */
export async function deleteOwnStoredFiles(userId: string): Promise<number> {
  let removed = 0;
  for (const bucket of USER_BUCKETS) {
    const paths = await listFiles(bucket, userId);
    for (const group of chunk(paths, PAGE)) {
      const { error } = await supabase.storage.from(bucket).remove(group);
      if (error) throw error;
      removed += group.length;
    }
  }
  return removed;
}
