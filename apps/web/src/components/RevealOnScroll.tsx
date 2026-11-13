'use client';

import { useEffect } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MOTION, prefersReducedMotion, setupGsap } from '@/lib/motion';

/**
 * "Appear" motion for the page it is placed on: every element with a `data-reveal` attribute fades in and rises a
 * few pixels the first time it scrolls into view (GSAP ScrollTrigger). Elements that enter together come in one
 * after another. Elements already on screen at load are left alone, nothing moves when the visitor prefers reduced
 * motion, and without JavaScript the page simply shows everything.
 */
export function RevealOnScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const gsap = setupGsap();
    // Only content still below the screen waits. Content above it (the page was reloaded or opened mid-way) is left
    // alone, otherwise it would be hidden with no way to reveal it again.
    const waiting = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]')).filter(
      (el) => el.getBoundingClientRect().top >= window.innerHeight,
    );
    if (!waiting.length) return;

    const ctx = gsap.context(() => {
      gsap.set(waiting, { autoAlpha: 0, y: 8 });
      const reveal = (batch: Element[]) =>
        gsap.to(batch, {
          autoAlpha: 1,
          y: 0,
          duration: MOTION.appear / 1000,
          ease: 'brand',
          stagger: Math.min(MOTION.stagger / 1000, 0.35 / batch.length),
          clearProps: 'transform,opacity,visibility',
          overwrite: true,
        });
      // onLeave too: a fast jump (an anchor link) can skip straight past an element, and it must still show.
      // No `once`: ScrollTrigger drops a `once` trigger whose end is already passed without calling onEnter.
      ScrollTrigger.batch(waiting, { start: 'top 92%', onEnter: reveal, onLeave: reveal });
    });
    // Never leave content hidden when printing.
    const showAll = () => gsap.set(waiting, { clearProps: 'transform,opacity,visibility' });
    window.addEventListener('beforeprint', showAll);
    return () => {
      window.removeEventListener('beforeprint', showAll);
      ctx.revert();
    };
  }, []);
  return null;
}
