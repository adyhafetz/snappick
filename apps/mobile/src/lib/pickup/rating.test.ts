import { describe, expect, it } from 'vitest';
import { formatRating } from './rating';

describe('formatRating', () => {
  it('treats zero ratings as unrated even though the stored default is 5.0', () => {
    expect(formatRating(5, 0)).toEqual({ rated: false });
    expect(formatRating('5.00', null)).toEqual({ rated: false });
    expect(formatRating(undefined, undefined)).toEqual({ rated: false });
  });

  it('formats a real average with its count', () => {
    expect(formatRating(4, 1)).toEqual({ rated: true, average: '4.0', count: 1 });
    expect(formatRating('4.33', 3)).toEqual({ rated: true, average: '4.3', count: 3 });
  });

  it('ignores non-numeric values', () => {
    expect(formatRating('abc', 2)).toEqual({ rated: false });
  });
});
