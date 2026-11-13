import * as React from 'react';
import { useCountUp } from '@/lib/motion';

/** A whole number that counts to its new value (place it inside a Text). */
export function CountUp({ value }: { value: number }) {
  const shown = useCountUp(value);
  return <>{Math.round(shown).toLocaleString('en-GB')}</>;
}
