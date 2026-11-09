'use client';

import { Check, Download, ExternalLink, FileText, Loader2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DateRange } from '@/lib/snapshot';

const STAGE_MS = 1100;
const MIN_MS = 3800; // long enough to read the steps; the real report may take longer (it waits for the AI)

type State = { phase: 'writing' } | { phase: 'ready'; url: string; ai: boolean } | { phase: 'error'; message: string };

/** The "Preview report" button and the window it opens. SnapBot "writes" the report (the PDF is really built on the server), then it can be downloaded. */
export function ReportPreview({ period, district, where, range = null }: { period: string; district: string; where: string; range?: DateRange | null }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ phase: 'writing' });
  const [stage, setStage] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const urlRef = useRef<string | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const ctl = new AbortController();
    const started = Date.now();
    setState({ phase: 'writing' });
    setStage(0);

    const tick = window.setInterval(() => setStage((s) => Math.min(s + 1, 2)), STAGE_MS);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', key);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    (async () => {
      try {
        const res = await fetch(`/api/report?period=${period}&district=${district}&inline=1${range ? `&from=${range.from}&to=${range.to}` : ''}`, { signal: ctl.signal });
        if (!res.ok) {
          const b = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(b?.error ?? 'The report could not be built.');
        }
        const ai = res.headers.get('X-Report-AI') === '1';
        const blob = await res.blob();
        const wait = Math.max(0, MIN_MS - (Date.now() - started));
        await new Promise((r) => setTimeout(r, wait));
        if (!live) return;
        urlRef.current = URL.createObjectURL(blob);
        window.clearInterval(tick);
        setStage(3);
        setState({ phase: 'ready', url: urlRef.current, ai });
      } catch (e) {
        if (!live || (e instanceof DOMException && e.name === 'AbortError')) return;
        window.clearInterval(tick);
        setState({ phase: 'error', message: e instanceof Error ? e.message : 'The report could not be built.' });
      }
    })();

    return () => {
      live = false;
      ctl.abort();
      window.clearInterval(tick);
      window.removeEventListener('keydown', key);
      document.body.style.overflow = prevOverflow;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, [open, period, district, range, attempt, close]);

  const steps = [`Reading the published figures for ${where}`, 'Hiding anything based on fewer than 5 households', 'Writing the insights and suggestions', 'Laying out the report'];
  const filename = `snappick-report-${district}-${range ? `${range.from}_${range.to}` : period}.pdf`;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="ml-auto inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2 text-sm font-medium text-white hover:bg-ink/90">
        <FileText size={16} /> Preview report
      </button>

      {open &&
        createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(10,28,33,0.62)] p-4" role="dialog" aria-modal="true" aria-label="Report preview" onClick={close}>
          <div className="flex h-[min(46rem,92vh)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center gap-3 border-b border-border bg-card px-5 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/snapbot-icon.svg" alt="" width={36} height={36} className={state.phase === 'writing' ? 'animate-float' : ''} />
              <div className="min-w-0 flex-1">
                <p className="font-bold leading-tight">
                  {state.phase === 'writing' ? 'SnapBot is writing your report…' : state.phase === 'ready' ? 'Your report is ready' : 'Something went wrong'}
                </p>
                <p className="truncate text-xs text-muted-foreground">{where}</p>
              </div>
              {state.phase === 'ready' && (
                <>
                  <a href={state.url} target="_blank" rel="noreferrer" className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-primary hover:bg-secondary sm:inline-flex">
                    <ExternalLink size={16} /> Open
                  </a>
                  <a href={state.url} download={filename} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark">
                    <Download size={16} /> Download
                  </a>
                </>
              )}
              <button type="button" onClick={close} aria-label="Close preview" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary/70 text-muted-foreground hover:bg-secondary">
                <X size={20} />
              </button>
            </header>

            {state.phase === 'writing' && (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
                <div className="w-full max-w-sm space-y-4" aria-live="polite">
                  {steps.map((s, i) => (
                    <div key={s} className={`flex items-center gap-3 text-sm transition-opacity duration-300 ${i > stage ? 'opacity-30' : 'opacity-100'}`}>
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${i < stage ? 'bg-primary text-white' : 'bg-secondary text-primary'}`}>
                        {i < stage ? <Check size={14} /> : i === stage ? <Loader2 size={14} className="animate-spin" /> : null}
                      </span>
                      <span className={i === stage ? 'font-medium' : ''}>{s}</span>
                    </div>
                  ))}
                </div>
                <div className="w-full max-w-sm space-y-2" aria-hidden>
                  {[100, 92, 96, 70].map((w, i) => (
                    <div key={i} className="h-2.5 animate-pulse rounded-full bg-secondary" style={{ width: `${w}%`, animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            )}

            {state.phase === 'error' && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
                <p className="max-w-md text-sm">{state.message}</p>
                <button type="button" onClick={() => setAttempt((n) => n + 1)} className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-dark">
                  Try again
                </button>
              </div>
            )}

            {state.phase === 'ready' && (
              <>
                <iframe title="Report preview" src={state.url} className="w-full flex-1 bg-white" />
                <p className="border-t border-border bg-card px-5 py-2 text-xs text-muted-foreground">
                  {state.ai ? 'All insights and suggestions are AI-generated from real SnapPick data.' : 'All insights and suggestions are generated automatically from real SnapPick data.'}
                </p>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
