import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase-server';

/**
 * Starts a Kaggle training run.
 *
 * The run always goes to ONE fixed notebook (KAGGLE_KERNEL_SLUG / KAGGLE_KERNEL_TITLE).
 * Kaggle derives a notebook's name from its title, so a per-version title would create a new
 * notebook every time: titles collide (HTTP 409) and the new notebook has no Kaggle secrets
 * attached, so it cannot reach Supabase. Pushing new versions of one notebook keeps the secrets.
 */
export async function POST() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const supabase = auth.supabase;

  try {
    // 1. Verified training images (informational; the notebook reads Supabase itself)
    const { data: scans, error: scansErr } = await supabase
      .from('scans')
      .select('id, image_path')
      .eq('image_storage_consent', true)
      .eq('training_opt_in', true)
      .not('image_path', 'is', null);
    if (scansErr) throw scansErr;

    const { data: feedback } = await supabase
      .from('label_feedback')
      .select('scan_id, feedback_type, collector_verified_at');

    const unverifiedScanIds = new Set(
      (feedback || [])
        .filter(
          (f) =>
            (f.feedback_type === 'change_label' || f.feedback_type === 'remove') &&
            !f.collector_verified_at
        )
        .map((f) => f.scan_id)
    );
    const readyCount = (scans || []).filter((s) => !unverifiedScanIds.has(s.id)).length;
    // Retraining with 0 community images is allowed: the notebook still trains on the base dataset.

    // 2. Next model version (the notebook picks the same number when it registers the model)
    const { data: existingModels } = await supabase.from('model_versions').select('version');
    let nextVerNum = 1;
    (existingModels || []).forEach((m) => {
      const match = String(m.version).match(/^v(\d+)$/i);
      if (match) nextVerNum = Math.max(nextVerNum, parseInt(match[1], 10) + 1);
    });
    const nextVersion = `v${nextVerNum}`;

    // 3. Push the notebook to Kaggle
    const kaggleUsername = process.env.KAGGLE_USERNAME;
    const kaggleKey = process.env.KAGGLE_KEY;
    if (!kaggleUsername || !kaggleKey) {
      return NextResponse.json(
        { error: 'Kaggle is not configured. Set KAGGLE_USERNAME and KAGGLE_KEY in apps/admin/.env.local.' },
        { status: 400 }
      );
    }

    const authHeader = kaggleKey.startsWith('KGAT_')
      ? `Bearer ${kaggleKey}`
      : `Basic ${Buffer.from(`${kaggleUsername}:${kaggleKey}`).toString('base64')}`;

    const kernelSlug = process.env.KAGGLE_KERNEL_SLUG || `${kaggleUsername}/snappick-ml`;
    // The title must slugify to the slug's name, otherwise Kaggle makes a different notebook.
    const kernelTitle =
      process.env.KAGGLE_KERNEL_TITLE ||
      (kernelSlug.split('/').pop() || 'snappick-ml')
        .split('-')
        .map((w) => w.toUpperCase() === 'ML' ? 'ML' : w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

    const fs = await import('fs');
    const path = await import('path');
    const candidates = [
      path.resolve(process.cwd(), '../../ml/notebooks/kaggle_waste_detector_retraining.ipynb'),
      path.resolve(process.cwd(), 'ml/notebooks/kaggle_waste_detector_retraining.ipynb'),
    ];
    const notebookPath = candidates.find((p) => fs.existsSync(p));
    if (!notebookPath) {
      return NextResponse.json({ error: 'Training notebook file was not found in the repository.' }, { status: 500 });
    }
    const notebookContent = fs.readFileSync(notebookPath, 'utf-8');

    const dataset = ['sumn2u/garbage-classification-v2-bbox-384'];
    const kaggleRes = await fetch('https://www.kaggle.com/api/v1/kernels/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({
        slug: kernelSlug,
        newTitle: kernelTitle,
        text: notebookContent,
        language: 'python',
        kernelType: 'notebook',
        isPrivate: true,
        enableGpu: true,
        enableInternet: true,
        datasetSources: dataset,
        dataset_sources: dataset,
        datasetDataSources: dataset,
        dataset_data_sources: dataset,
      }),
    });

    const rawBody = await kaggleRes.text();
    let parsed: { error?: string; ref?: string; url?: string; versionNumber?: number } = {};
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      // non-JSON body
    }
    const pushError = !kaggleRes.ok ? rawBody || `HTTP ${kaggleRes.status}` : parsed.error || null;
    if (pushError) {
      console.warn('Kaggle API push error:', pushError);
      return NextResponse.json({ error: `Kaggle did not start the run: ${pushError}` }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      target_version: nextVersion,
      images_count: readyCount,
      kernel_ref: parsed.ref || kernelSlug,
      kernel_url: parsed.url || `https://www.kaggle.com/code/${kernelSlug}`,
      status: 'kaggle_running',
      message: `Kaggle GPU retraining started for ${nextVersion}.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error triggering retrain';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
