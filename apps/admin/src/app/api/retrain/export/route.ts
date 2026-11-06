import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase-server';
import { resolveTrainingClass } from '@/lib/training-labels';

const YOLO_CLASSES = ['metal', 'trash', 'glass', 'paper', 'cardboard', 'plastic', 'biological'];

export async function GET() {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  const supabase = auth.supabase;
  try {
    // 1. Fetch consented scans
    const { data: scans, error: scansErr } = await supabase
      .from('scans')
      .select('id, image_path, image_width, image_height, created_at')
      .eq('image_storage_consent', true)
      .eq('training_opt_in', true)
      .not('image_path', 'is', null);

    if (scansErr) throw scansErr;
    if (!scans || scans.length === 0) {
      return NextResponse.json({
        samples_count: 0,
        samples: [],
        message: 'No consented training images found yet.',
      });
    }

    const scanIds = scans.map((s) => s.id);

    // 2. Fetch detections for these scans
    const { data: detections, error: detErr } = await supabase
      .from('detections')
      .select('id, scan_id, model_label, app_class, box_x1, box_y1, box_x2, box_y2')
      .in('scan_id', scanIds);

    if (detErr) throw detErr;

    // 3. Fetch feedback records (to see which were changed by users)
    const { data: feedback, error: fbErr } = await supabase
      .from('label_feedback')
      .select('id, scan_id, detection_id, original_model_label, corrected_app_class, feedback_type, collector_verified_at')
      .in('scan_id', scanIds);

    if (fbErr) throw fbErr;

    const feedbackByScan = new Map<string, typeof feedback>();
    (feedback || []).forEach((fb) => {
      const list = feedbackByScan.get(fb.scan_id) || [];
      list.push(fb);
      feedbackByScan.set(fb.scan_id, list);
    });

    const readySamples = [];

    for (const scan of scans) {
      const scanFeedback = feedbackByScan.get(scan.id) || [];
      const hasUnverifiedChanges = scanFeedback.some(
        (fb) =>
          (fb.feedback_type === 'change_label' || fb.feedback_type === 'remove') &&
          !fb.collector_verified_at
      );

      // If resident changed a label and admin has NOT verified yet, exclude from ready bucket!
      if (hasUnverifiedChanges) {
        continue;
      }

      const scanDetections = (detections || []).filter((d) => d.scan_id === scan.id);
      const boxes = [];

      for (const det of scanDetections) {
        const resolved = resolveTrainingClass(det, scanFeedback);
        if (resolved.skip) continue;
        const effectiveClass = resolved.className;
        const classIdx = YOLO_CLASSES.indexOf(effectiveClass.toLowerCase());

        if (classIdx >= 0 && det.box_x1 != null && det.box_y1 != null && det.box_x2 != null && det.box_y2 != null) {
          const x1 = Number(det.box_x1);
          const y1 = Number(det.box_y1);
          const x2 = Number(det.box_x2);
          const y2 = Number(det.box_y2);
          const cx = Number(((x1 + x2) / 2).toFixed(6));
          const cy = Number(((y1 + y2) / 2).toFixed(6));
          const w = Number((x2 - x1).toFixed(6));
          const h = Number((y2 - y1).toFixed(6));

          boxes.push({
            class_name: effectiveClass,
            class_index: classIdx,
            yolo_line: `${classIdx} ${cx} ${cy} ${w} ${h}`,
            bbox: [cx, cy, w, h],
          });
        }
      }

      readySamples.push({
        scan_id: scan.id,
        image_storage_path: scan.image_path,
        dimensions: { width: scan.image_width, height: scan.image_height },
        created_at: scan.created_at,
        annotations: boxes,
      });
    }

    return NextResponse.json({
      exported_at: new Date().toISOString(),
      classes: YOLO_CLASSES,
      ready_bucket_size: readySamples.length,
      samples: readySamples,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 }
    );
  }
}

