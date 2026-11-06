/**
 * Which user/admin label edits change what a detection is trained as.
 * Shared by the export route; the Kaggle notebook (ml/notebooks/kaggle_waste_detector_retraining.ipynb)
 * applies the same rules.
 *
 * - `remove`       -> the detection is dropped from training.
 * - `change_label` -> the corrected class replaces the model's label.
 * - everything else (`confirm`, `condition_change`, `discarded`) does not change the label.
 *   A `discarded` row is an edit the admin rejected, so its proposed class must be ignored.
 */
export interface LabelFeedbackRow {
  detection_id?: string | null;
  original_model_label: string | null;
  corrected_app_class: string | null;
  feedback_type: string;
}

export interface DetectionRow {
  id?: string;
  model_label: string;
  app_class: string | null;
}

export function resolveTrainingClass(
  det: DetectionRow,
  feedback: LabelFeedbackRow[]
): { skip: true } | { skip: false; className: string } {
  const relevant = feedback.filter(
    (f) => f.feedback_type === 'remove' || f.feedback_type === 'change_label'
  );
  const match =
    relevant.find((f) => f.detection_id && f.detection_id === det.id) ??
    relevant.find((f) => !f.detection_id && f.original_model_label === det.model_label);

  if (match?.feedback_type === 'remove') return { skip: true };
  const className = (
    (match?.feedback_type === 'change_label' ? match.corrected_app_class : null) ||
    det.app_class ||
    det.model_label
  ).toLowerCase();
  return { skip: false, className };
}
