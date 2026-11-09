export interface Highlight {
  /** Position and size as a percentage of the screenshot. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A phone frame around a full screenshot of the SnapPick app (taken from the app on an Android phone; the
 * dev-tools button is painted out and personal details and third-party photos are blurred).
 * Every phone uses the same screen ratio, so they are all the same size. An optional pulsing box marks the
 * part of the screen a feature is about.
 */
export function Phone({ src, alt, highlight, className = '', width = 260 }: { src: string; alt: string; highlight?: Highlight; className?: string; width?: number }) {
  return (
    <div className={`relative mx-auto rounded-[2.4rem] bg-ink p-2 shadow-2xl ring-1 ring-black/10 ${className}`} style={{ width }}>
      <div className="relative overflow-hidden rounded-[2rem]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} width={560} height={1244} className="block h-auto w-full" loading="lazy" />
        {highlight && (
          <span
            aria-hidden
            className="pointer-events-none absolute animate-pulse-ring rounded-2xl border-[3px] border-brandAmber bg-brandAmber/10"
            style={{ left: `${highlight.x}%`, top: `${highlight.y}%`, width: `${highlight.w}%`, height: `${highlight.h}%` }}
          />
        )}
      </div>
    </div>
  );
}
