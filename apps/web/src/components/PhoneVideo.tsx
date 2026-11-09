'use client';

import { useEffect, useRef } from 'react';

/**
 * A short screen recording of the app inside the same phone frame as the screenshots.
 * It plays muted and in a loop while it is on screen, pauses when scrolled away, and stays on the poster
 * when the visitor prefers reduced motion.
 */
export function PhoneVideo({ name, alt, width = 260, className = '' }: { name: string; alt: string; width?: number; className?: string }) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !reduce) el.play().catch(() => undefined);
        else el.pause();
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className={`relative mx-auto rounded-[2.4rem] bg-ink p-2 shadow-2xl ring-1 ring-black/10 ${className}`} style={{ width }}>
      <div className="relative overflow-hidden rounded-[2rem]">
        <video
          ref={video}
          className="block h-auto w-full"
          width={540}
          height={1200}
          poster={`/posters/${name}.webp`}
          muted
          loop
          playsInline
          preload="none"
          aria-label={alt}
        >
          <source src={`/videos/${name}.mp4`} type="video/mp4" />
        </video>
      </div>
    </div>
  );
}
