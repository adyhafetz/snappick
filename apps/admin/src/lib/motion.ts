'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

/**
 * SnapPick motion system (same rules in the website, admin and mobile app; see docs/BRAND_IDENTITY.md):
 *   press  150 ms  a slight shrink when something is pressed (CSS)
 *   appear 250 ms  content fades in and rises a few pixels, lists one after another (CSS)
 *   moment 500 ms  only for things that matter: a number counting to its new value (GSAP), a bar growing (CSS)
 * Everything is skipped when the visitor prefers reduced motion.
 */
export const MOTION = { press: 150, appear: 250, moment: 500, stagger: 70, ease: 'cubic-bezier(.2,.7,.2,1)' } as const;

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Counts from the previous value to `target` over a "moment". The first value is shown as is. */
export function useCountUp(target: number, duration: number = MOTION.moment): number {
  const [shown, setShown] = useState(target);
  const state = useRef({ v: target });

  useEffect(() => {
    const s = state.current;
    // Nothing to animate, nobody to see it, or the visitor asked for less motion: show the real value now.
    if (s.v === target || prefersReducedMotion() || document.hidden) {
      gsap.killTweensOf(s);
      s.v = target;
      setShown(target);
      return;
    }
    const tween = gsap.to(s, {
      v: target,
      duration: duration / 1000,
      ease: 'power3.out',
      overwrite: true,
      onUpdate: () => setShown(s.v),
      onComplete: () => setShown(target),
    });
    return () => {
      tween.kill();
    };
  }, [target, duration]);

  return shown;
}
