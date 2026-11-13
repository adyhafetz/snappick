import { useEffect, useRef, useState } from 'react';
import { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated';

/**
 * SnapPick motion system (same rules in the website, admin and mobile app; see docs/BRAND_IDENTITY.md):
 *   press  150 ms  a slight shrink while something is pressed (AnimatedPressable)
 *   appear 250 ms  content fades in and rises a few pixels, lists one after another
 *   moment 500 ms  only for things that matter, such as a number counting to its new value
 * Reanimated's entering animations follow the phone's reduce-motion setting by default (ReduceMotion.System).
 */
export const MOTION = { press: 150, appear: 250, moment: 500, stagger: 70 } as const;
const EASE = Easing.bezier(0.2, 0.7, 0.2, 1);

/** Entering animation for a block or list row; `index` staggers rows (capped so long lists do not drag). */
export function appear(index = 0) {
  return FadeInDown.duration(MOTION.appear)
    .delay(Math.min(index, 5) * MOTION.stagger)
    .easing(EASE)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] });
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Counts from the previous value to `target` over a "moment"; the first value is shown as is. */
export function useCountUp(target: number, duration: number = MOTION.moment): number {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    const start = from.current;
    if (start === target || reduce) {
      from.current = target;
      setShown(target);
      return;
    }
    let frame: number | null = null;
    const t0 = Date.now();
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const v = start + (target - start) * easeOut(p);
      from.current = v;
      setShown(v);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    // Safety net: always land on the real value, even if frames are paused.
    const settle = setTimeout(() => {
      if (frame !== null) cancelAnimationFrame(frame);
      from.current = target;
      setShown(target);
    }, duration + 60);
    return () => {
      clearTimeout(settle);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [target, duration, reduce]);

  return shown;
}
