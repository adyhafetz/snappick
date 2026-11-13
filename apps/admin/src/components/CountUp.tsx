'use client';

import { useCountUp } from '@/lib/motion';

/** A number that counts to its new value when a filter changes (a "moment"); shown as is on first load. */
export function CountUp({ value, format = (v) => Math.round(v).toLocaleString('en-GB') }: { value: number; format?: (v: number) => string }) {
  const shown = useCountUp(value);
  return <>{format(shown)}</>;
}
