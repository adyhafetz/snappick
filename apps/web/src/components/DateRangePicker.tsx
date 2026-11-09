'use client';

import { CalendarDays, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { type DateRange, MIN_RANGE_DAYS, parseRange, periodText } from '@/lib/snapshot';

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Today's date in Malaysia, as YYYY-MM-DD. */
export function todayInPerak(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' });
}

/** The "Custom range" button with a small panel holding two date fields. Calls onApply with a valid range only. */
export function DateRangePicker({ active, range, min, onApply }: { active: boolean; range: DateRange | null; min: string; onApply: (r: DateRange) => void }) {
  const today = todayInPerak();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      setFrom(range?.from ?? iso(new Date(Date.parse(`${today}T00:00:00Z`) - 29 * DAY)));
      setTo(range?.to ?? today);
      setError(null);
    }
    setOpen((v) => !v);
  }

  function apply() {
    const r = parseRange(from, to);
    if (!r) return setError(`Pick a start and an end date at least ${MIN_RANGE_DAYS} days apart.`);
    if (r.to > today) return setError('The end date cannot be in the future.');
    if (r.from < min) return setError('There is no data before that date.');
    onApply(r);
    setOpen(false);
  }

  const preset = (days: number) => {
    setFrom(iso(new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * DAY)));
    setTo(today);
    setError(null);
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-pressed={active}
        className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${active ? 'bg-primary text-white shadow-sm' : 'text-ink/70 hover:text-ink'}`}
      >
        <CalendarDays size={16} />
        {active && range ? periodText('custom', range) : 'Custom range'}
        <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <div role="dialog" aria-label="Choose a date range" className="absolute left-0 z-30 mt-3 w-[19rem] rounded-2xl border border-border bg-card p-4 shadow-xl">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-muted-foreground">
              From
              <input type="date" value={from} min={min} max={today} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-2 text-sm text-ink" />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              To
              <input type="date" value={to} min={min} max={today} onChange={(e) => setTo(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-2 text-sm text-ink" />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[7, 14, 30].map((d) => (
              <button key={d} type="button" onClick={() => preset(d)} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-secondary">
                Last {d} days
              </button>
            ))}
          </div>
          {error && <p role="alert" className="mt-3 text-xs text-[#b45309]">{error}</p>}
          <button type="button" onClick={apply} className="mt-4 w-full rounded-full bg-primary py-2 text-sm font-medium text-white hover:bg-primary-dark">
            Show this range
          </button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">At least {MIN_RANGE_DAYS} days. Figures from fewer than 5 households stay hidden.</p>
        </div>
      )}
    </div>
  );
}
