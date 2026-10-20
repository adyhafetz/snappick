import { describe, expect, it } from 'vitest';
import { toSubmission, validateChecklist, type ChecklistRow } from './checklist';

const row = (overrides: Partial<ChecklistRow> = {}): ChecklistRow => ({ id: '1', requesterQuantity: 2, collectedQuantity: 2, condition: 'clean_dry', ...overrides });

describe('collection checklist validation', () => {
  it('accepts bounded quantities and verified condition', () => expect(validateChecklist([row()])).toBeNull());
  it('rejects quantities above requested amount', () => expect(validateChecklist([row({ collectedQuantity: 3 })])).toMatch(/whole numbers/));
  it('requires a reason for a partial collection', () => expect(validateChecklist([row({ collectedQuantity: 1 })])).toMatch(/reason/));
  it('requires a request-level reason and proof for zero collection', () => {
    expect(validateChecklist([row({ collectedQuantity: 0, reason: 'missing' })])).toMatch(/evidence/);
    expect(validateChecklist([row({ collectedQuantity: 0, reason: 'missing' })], true, 'missing')).toBeNull();
  });
  it('serializes only the collector fields', () => expect(toSubmission([row({ collectedQuantity: 1, reason: 'missing' })])).toEqual([{ id: '1', quantity: 1, condition: 'clean_dry', reason: 'missing' }]));
});
