/**
 * Collector ratings. A profile with no ratings yet has `rating_avg` = 5.0 in the
 * database; never show that default as if it were earned.
 */
export type RatingDisplay =
  | { rated: true; average: string; count: number }
  | { rated: false };

export function formatRating(average?: number | string | null, count?: number | null): RatingDisplay {
  const total = Number(count ?? 0);
  const value = Number(average);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(value)) return { rated: false };
  return { rated: true, average: value.toFixed(1), count: total };
}
