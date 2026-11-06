import { describe, expect, it, vi } from 'vitest';

import { chunk } from './delete-stored-files';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('chunk', () => {
  it('splits a list into groups of the given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns no groups for an empty list', () => {
    expect(chunk([], 100)).toEqual([]);
  });
});
