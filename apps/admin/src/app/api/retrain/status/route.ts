import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase-server';

export type RetrainState = 'queued' | 'running' | 'complete' | 'failed' | 'unknown';

// Kaggle's status strings: "queued", "running", "complete", "error", "cancelAcknowledged"
// (sometimes prefixed, e.g. "KernelWorkerStatus.RUNNING"). Normalise defensively.
function normaliseKaggleStatus(raw: unknown): RetrainState {
  const s = String(raw ?? '').toLowerCase();
  if (!s) return 'unknown';
  if (s.includes('queue')) return 'queued';
  if (s.includes('run')) return 'running';
  if (s.includes('complete')) return 'complete';
  if (s.includes('error') || s.includes('cancel') || s.includes('fail')) return 'failed';
  return 'unknown';
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const supabase = auth.supabase;

  const version = req.nextUrl.searchParams.get('version')?.toLowerCase();
  if (!version || !/^v\d+$/.test(version)) {
    return NextResponse.json({ error: 'Invalid version' }, { status: 400 });
  }
  const since = Number(req.nextUrl.searchParams.get('since')) || 0;

  try {
    // 1. Has the notebook registered the model yet? (the real success signal)
    const { data: row } = await supabase
      .from('model_versions')
      .select('version')
      .eq('version', version)
      .maybeSingle();
    const modelReady = Boolean(row);

    // 2. Ask Kaggle about the fixed notebook.
    let state: RetrainState = 'unknown';
    let detail: string | null = null;

    const username = process.env.KAGGLE_USERNAME;
    const key = process.env.KAGGLE_KEY;
    const kernelUrl = (() => {
      const slug = process.env.KAGGLE_KERNEL_SLUG || (username ? `${username}/snappick-ml` : '');
      return slug ? `https://www.kaggle.com/code/${slug}` : null;
    })();

    if (username && key) {
      const parts = (process.env.KAGGLE_KERNEL_SLUG || `${username}/snappick-ml`).split('/');
      const owner = parts.length > 1 ? parts[0] : username;
      const kernelSlug = parts[parts.length - 1];
      const headers = {
        Authorization: key.startsWith('KGAT_')
          ? `Bearer ${key}`
          : `Basic ${Buffer.from(`${username}:${key}`).toString('base64')}`,
        Accept: 'application/json',
      };
      const q = (o: Record<string, string>) => new URLSearchParams(o).toString();

      try {
        const [statusRes, listRes] = await Promise.all([
          fetch(`https://www.kaggle.com/api/v1/kernels/status?${q({ userName: owner, kernelSlug })}`, { headers, cache: 'no-store' }),
          fetch(`https://www.kaggle.com/api/v1/kernels/list?${q({ user: owner, pageSize: '30', sortBy: 'dateRun' })}`, { headers, cache: 'no-store' }),
        ]);

        if (statusRes.status === 404) {
          // Notebook not visible yet right after the very first push.
          state = 'queued';
        } else if (statusRes.ok) {
          const body = (await statusRes.json()) as { status?: string; failureMessage?: string };
          state = normaliseKaggleStatus(body.status);
          detail = body.failureMessage || null;
        }

        // The status endpoint reports the LATEST run. Right after a push it can still show the
        // previous run's result, so ignore it until the new run's start time is reflected.
        if (since && listRes.ok && state !== 'unknown') {
          const list = (await listRes.json()) as Array<{ ref?: string; lastRunTime?: string }>;
          const mine = list.find((k) => k.ref === `${owner}/${kernelSlug}`);
          const lastRun = mine?.lastRunTime ? Date.parse(mine.lastRunTime) : 0;
          if (!lastRun || lastRun < since - 2 * 60 * 1000) {
            state = 'queued';
            detail = null;
          }
        }
      } catch (err) {
        console.warn('Kaggle status error:', err);
      }
    }

    if (modelReady) state = 'complete';

    return NextResponse.json({ state, modelReady, detail, kernelUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Status check failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
