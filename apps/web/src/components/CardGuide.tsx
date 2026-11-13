'use client';

import { HelpCircle, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { setupGsap } from '@/lib/motion';

const BOT = 72;
const PAD = 10;
const FLY_MS = 750;
const SCROLL_MS = 450;
const THINK_MS = 1100;
const TOP_GAP = 130; // clears the sticky header and filter bar

/** The small "?" button on a card. */
export function HelpButton({ label, onClick, dark = false }: { label: string; onClick: () => void; dark?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ask SnapBot about ${label}`}
      title="Ask SnapBot about this"
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${dark ? 'text-white/70 hover:bg-white/15 hover:text-white' : 'text-muted-foreground hover:bg-secondary hover:text-primary'}`}
    >
      <HelpCircle size={18} />
    </button>
  );
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

type Phase = 'flying' | 'thinking' | 'talking';

/**
 * SnapBot flies to the card, the rest of the page dims (still visible through the dark layer), a typing indicator
 * shows for a moment, then the explanation is typed into a square speech bubble.
 */
export function CardGuide({ target, text, onClose }: { target: string; text: string; onClose: () => void }) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [armed, setArmed] = useState(false);
  const [phase, setPhase] = useState<Phase>('flying');
  const [shown, setShown] = useState(0);
  const [row, setRow] = useState({ w: 340, h: 160 });
  const rowRef = useRef<HTMLDivElement>(null);
  const reduce = useRef(false);
  const landed = useRef(false);

  const measure = useCallback(() => {
    const el = document.querySelector<HTMLElement>(`[data-help="${target}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [target]);

  // Bring the card into view, then keep the spotlight glued to it while the page scrolls or resizes.
  useEffect(() => {
    reduce.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const el = document.querySelector<HTMLElement>(`[data-help="${target}"]`);
    if (!el) {
      onClose();
      return;
    }
    const top = el.getBoundingClientRect().top + window.scrollY - TOP_GAP;
    window.scrollTo({ top: Math.max(0, top), behavior: reduce.current ? 'auto' : 'smooth' });
    measure();
    const on = () => measure();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
      window.removeEventListener('keydown', key);
    };
  }, [target, measure, onClose]);

  // One GSAP timeline: wait for the scroll, fly (the landing spot is tweened below), think, then type.
  useEffect(() => {
    const gsap = setupGsap();
    const r = reduce.current;
    const sec = (ms: number) => (r ? 0 : ms / 1000);
    const typed = { n: 0 };
    setArmed(false);
    setPhase('flying');
    setShown(0);
    landed.current = false;
    const tl = gsap
      .timeline()
      .call(() => setArmed(true), [], sec(SCROLL_MS))
      .call(() => setPhase('thinking'), [], `+=${sec(FLY_MS)}`)
      .call(() => setPhase('talking'), [], `+=${sec(THINK_MS)}`)
      .to(typed, { n: text.length, duration: sec((text.length / 125) * 1000), ease: 'none', onUpdate: () => setShown(Math.round(typed.n)) })
      .call(() => setShown(text.length));
    return () => {
      tl.kill();
    };
  }, [target, text]);

  useLayoutEffect(() => {
    const el = rowRef.current;
    if (el) setRow((p) => (p.w === el.offsetWidth && p.h === el.offsetHeight ? p : { w: el.offsetWidth, h: el.offsetHeight }));
  });

  const vw = typeof window === 'undefined' ? 1200 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight;

  // Where the bot (and its bubble) lands: below the card, else above it, else over the bottom of the screen.
  let pos = { left: vw - 16 - BOT, top: vh - 16 - BOT };
  if (rect && armed) {
    const left = Math.min(Math.max(16, rect.left), Math.max(16, vw - row.w - 16));
    const below = rect.top + rect.height + PAD + 14;
    const above = rect.top - PAD - 14 - row.h;
    if (below + row.h <= vh - 8) pos = { left, top: below };
    else if (above >= 8) pos = { left, top: above };
    else pos = { left, top: Math.max(8, vh - row.h - 16) };
  }

  // The bot flies to its landing spot once; after that it stays glued to the card while the page scrolls.
  useLayoutEffect(() => {
    const el = rowRef.current;
    if (!el) return;
    const gsap = setupGsap();
    if (!armed || reduce.current || landed.current) {
      gsap.killTweensOf(el);
      gsap.set(el, { left: pos.left, top: pos.top });
      return;
    }
    gsap.to(el, {
      left: pos.left,
      top: pos.top,
      duration: FLY_MS / 1000,
      ease: 'power3.inOut',
      overwrite: true,
      onComplete: () => {
        landed.current = true;
      },
    });
  }, [armed, pos.left, pos.top]);

  const bubbleVisible = phase !== 'flying';

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label="SnapBot explains this card">
      {/* Dark but see-through layer; a click anywhere on it closes the guide. */}
      <div className="absolute inset-0" onClick={onClose} />
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-[2.1rem] ring-2 ring-white/70"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: '0 0 0 100vmax rgba(10, 28, 33, 0.62)',
          }}
        />
      )}

      <div
        ref={rowRef}
        className="absolute flex items-end gap-2"
        style={{ width: `min(26rem, ${vw - 32}px)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/snapbot-icon.svg" alt="" width={BOT} height={BOT} className={`shrink-0 ${phase === 'talking' ? '' : 'animate-float'}`} />
        <div
          className={`relative min-w-0 flex-1 rounded-md bg-white p-4 text-sm shadow-xl transition-opacity duration-200 ${bubbleVisible ? 'opacity-100' : 'opacity-0'}`}
        >
          <span aria-hidden className="absolute -left-1.5 bottom-6 h-3 w-3 rotate-45 bg-white" />
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-1.5 top-1.5 rounded-full p-1 text-muted-foreground hover:bg-secondary">
            <X size={14} />
          </button>
          {/* The full text is always laid out (invisible) so the bubble never changes size while typing. */}
          <div className="grid pr-4">
            <p className="invisible col-start-1 row-start-1" aria-hidden>{text}</p>
            {phase === 'thinking' ? (
              <p className="col-start-1 row-start-1 flex items-center gap-1.5 text-muted-foreground" aria-label="SnapBot is thinking">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-primary/70" style={{ animationDelay: `${i * 140}ms` }} />
                ))}
                <span className="ml-1 text-xs">SnapBot is thinking…</span>
              </p>
            ) : (
              <p className="col-start-1 row-start-1" aria-hidden>
                {text.slice(0, shown)}
                {phase === 'talking' && shown < text.length && <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-primary" />}
              </p>
            )}
          </div>
          <p className="sr-only" role="status">{phase === 'talking' ? text : ''}</p>
        </div>
      </div>
    </div>
  );
}
