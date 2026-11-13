'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/**
 * SnapPick motion system (same rules in the website, admin and mobile app; see docs/BRAND_IDENTITY.md):
 *   press  150 ms  a slight shrink when something is pressed (CSS)
 *   appear 250 ms  content fades in and rises a few pixels, lists one after another (CSS on load, GSAP on scroll)
 *   moment 500 ms  only for things that matter: a number counting to its new value, a bar growing (GSAP for numbers)
 * Everything is skipped when the visitor prefers reduced motion.
 */
export const MOTION = { press: 150, appear: 250, moment: 500, stagger: 70, ease: 'cubic-bezier(.2,.7,.2,1)' } as const;

let registered = false;
/** Registers the GSAP plugins once (browser only) and the brand ease, usable as `ease: 'brand'`. */
export function setupGsap() {
  if (!registered && typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger, CustomEase);
    CustomEase.create('brand', 'M0,0 C0.2,0.7 0.2,1 1,1');
    registered = true;
  }
  return gsap;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Counts from the previous value to `target` over a "moment". The first value is shown as is. */
export function useCountUp(target: number, duration: number = MOTION.moment): number {
  const [shown, setShown] = useState(target);
  const state = useRef({ v: target });

  useEffect(() => {
    const g = setupGsap();
    const s = state.current;
    // Nothing to animate, nobody to see it, or the visitor asked for less motion: show the real value now.
    if (s.v === target || prefersReducedMotion() || document.hidden) {
      g.killTweensOf(s);
      s.v = target;
      setShown(target);
      return;
    }
    const tween = g.to(s, {
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
