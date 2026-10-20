export const CHECKLIST_REASONS = ['contaminated', 'missing', 'unsafe', 'access_issue', 'other'] as const;
export type ChecklistReason = typeof CHECKLIST_REASONS[number];
export const CONDITIONS = ['clean_dry', 'contaminated_wet', 'broken_unsafe', 'unknown'] as const;
export type ChecklistCondition = typeof CONDITIONS[number];

export type ChecklistRow = { id: string; requesterQuantity: number; collectedQuantity: number; condition: ChecklistCondition; reason?: ChecklistReason };

export function validateChecklist(rows: ChecklistRow[], hasEvidence = false, nonCollectionReason?: ChecklistReason): string | null {
  if (rows.length === 0) return 'Add at least one checklist item.';
  let total = 0;
  for (const row of rows) {
    if (!Number.isInteger(row.requesterQuantity) || row.requesterQuantity < 1) return 'Requested quantities are invalid.';
    if (!Number.isInteger(row.collectedQuantity) || row.collectedQuantity < 0 || row.collectedQuantity > row.requesterQuantity) return 'Collected quantities must be whole numbers within the requested quantity.';
    if (!CONDITIONS.includes(row.condition)) return 'Choose a verified condition for every item.';
    if (row.collectedQuantity < row.requesterQuantity && (!row.reason || !CHECKLIST_REASONS.includes(row.reason))) return 'Choose a reason for every item that was not fully collected.';
    total += row.collectedQuantity;
  }
  if (total === 0 && (!hasEvidence || !nonCollectionReason || !CHECKLIST_REASONS.includes(nonCollectionReason))) return 'Choose a non-collection reason and upload evidence.';
  return null;
}

export function toSubmission(rows: ChecklistRow[]) {
  return rows.map((row) => ({ id: row.id, quantity: row.collectedQuantity, condition: row.condition, reason: row.collectedQuantity < row.requesterQuantity ? row.reason : null }));
}
