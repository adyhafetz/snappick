'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function MonthlyChart({ data }: { data: { label: string; completed: number | null }[] }) {
  if (data.length === 0) return <Empty />;
  return (
    <div className="h-64 w-full" role="img" aria-label={`Completed pickups per month: ${data.map((d) => `${d.label} ${d.completed ?? 'not enough data'}`).join(', ')}`}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="fillPrimary" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#19806d" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#19806d" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#d9e2dc" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#5b7072', fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: '#5b7072', fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            formatter={(v: number | string) => [v, 'Completed']}
            contentStyle={{ borderRadius: 12, border: '1px solid #d9e2dc', fontSize: 13 }}
          />
          <Area type="monotone" dataKey="completed" stroke="#19806d" strokeWidth={2.5} fill="url(#fillPrimary)" connectNulls={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface BarItem {
  key: string;
  label: string;
  value: number | null;
  note?: string;
  tone?: 'primary' | 'amber' | 'mint';
}

const TONE = { primary: 'bg-primary', amber: 'bg-brandAmber', mint: 'bg-[#b9d3c8]' } as const;

/** Horizontal bars with direct labels (no legend). A null value means the figure is hidden (fewer than 5 households). */
export function BarList({ items, unit = '', onSelect, selected }: { items: BarItem[]; unit?: string; onSelect?: (key: string) => void; selected?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value ?? 0));
  if (items.length === 0) return <Empty />;
  return (
    <ul className="space-y-2.5">
      {items.map((i) => {
        const inner = (
          <>
            <span className="w-28 shrink-0 truncate text-left text-sm">{i.label}</span>
            <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-muted">
              {i.value !== null && (
                <span className={`absolute inset-y-0 left-0 rounded-full ${TONE[i.tone ?? 'primary']}`} style={{ width: `${Math.max(2, (i.value / max) * 100)}%` }} />
              )}
            </span>
            <span className="min-w-[5.5rem] shrink-0 whitespace-nowrap text-right text-sm tabular-nums text-ink">
              {i.value === null ? <span className="text-xs text-muted-foreground">Not enough data</span> : `${i.value.toLocaleString('en-GB')}${unit}`}
              {i.note && i.value !== null && <span className="ml-1 text-xs text-muted-foreground">{i.note}</span>}
            </span>
          </>
        );
        return (
          <li key={i.key}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(i.key)}
                aria-pressed={selected === i.key}
                className={`flex w-full items-center gap-3 rounded-xl px-2 py-1 hover:bg-secondary ${selected === i.key ? 'bg-secondary' : ''}`}
              >
                {inner}
              </button>
            ) : (
              <div className="flex items-center gap-3 px-2 py-1">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Empty() {
  return <p className="py-10 text-center text-sm text-muted-foreground">No data for this selection yet.</p>;
}
