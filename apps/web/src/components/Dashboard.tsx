'use client';

import { Gauge, Home, PackageCheck, Recycle } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { explainCard, type HelpId } from '@/lib/cardHelp';
import { districtName, districtSummaries, formatPct, keyNumbers, materialsFor, monthlySeries, titleCase } from '@/lib/selectors';
import { type DateRange, type MaterialRow, PERIODS, type Period, type PeriodRow, periodText, type Snapshot, STATE } from '@/lib/snapshot';
import { CardGuide, HelpButton } from './CardGuide';
import { CountUp } from './CountUp';
import { BarList, MonthlyChart } from './charts';
import { DateRangePicker } from './DateRangePicker';
import { DistrictMap } from './DistrictMap';
import { DistrictSelect } from './DistrictSelect';
import { ReportPreview } from './ReportPreview';
import { SnapBot } from './SnapBot';

interface Help {
  id: HelpId;
  onAsk: (id: HelpId) => void;
}

function Card({ id, title, action, help, children, className = '', delay = 0 }: { id?: string; title?: string; action?: React.ReactNode; help?: Help; children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <section id={id} data-help={help?.id} style={{ animationDelay: `${delay}ms` }} className={`animate-appear rounded-[1.75rem] bg-card p-6 shadow-sm ring-1 ring-border ${className}`}>
      {(title || action) && (
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5">
            {title && <h2 className="text-base font-bold">{title}</h2>}
            {help && title && <HelpButton label={title} onClick={() => help.onAsk(help.id)} />}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Stat({ icon: Icon, label, value, note, help, delay = 0 }: { icon: typeof Gauge; label: string; value: React.ReactNode; note?: string; help: Help; delay?: number }) {
  return (
    <div data-help={help.id} style={{ animationDelay: `${delay}ms` }} className="animate-appear rounded-[1.75rem] bg-card p-5 shadow-sm ring-1 ring-border">
      <div className="flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary text-primary">
          <Icon size={20} />
        </span>
        <HelpButton label={label} onClick={() => help.onAsk(help.id)} />
      </div>
      <p className="mt-4 text-4xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

export function Dashboard({ snapshot: base, aiEnabled = false }: { snapshot: Snapshot; aiEnabled?: boolean }) {
  const [period, setPeriod] = useState<Period>('all');
  const [range, setRange] = useState<DateRange | null>(null);
  const [extra, setExtra] = useState<{ period: PeriodRow[]; materials: MaterialRow[] } | null>(null);
  const [rangeBusy, setRangeBusy] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [district, setDistrict] = useState<string>(STATE);
  const [showTable, setShowTable] = useState(false);
  const [guide, setGuide] = useState<HelpId | null>(null);
  const closeGuide = useCallback(() => setGuide(null), []);

  // The figures for a chosen date range are loaded on demand and added to the published snapshot.
  const snapshot = useMemo<Snapshot>(
    () => (period === 'custom' && range && extra ? { ...base, range, period: [...base.period, ...extra.period], materials: [...base.materials, ...extra.materials] } : base),
    [base, period, range, extra],
  );
  const earliest = useMemo(() => base.monthly.reduce((m, r) => (r.month < m ? r.month : m), '2099-01-01').replace(/^2099.*/, '2025-01-01'), [base]);

  async function applyRange(r: DateRange) {
    setRangeBusy(true);
    setRangeError(null);
    try {
      const res = await fetch(`/api/range?from=${r.from}&to=${r.to}`);
      const body = (await res.json()) as { period?: PeriodRow[]; materials?: MaterialRow[]; error?: string };
      if (!res.ok || !body.period) throw new Error(body.error ?? 'Could not load that range.');
      setExtra({ period: body.period, materials: body.materials ?? [] });
      setRange(r);
      setPeriod('custom');
    } catch (e) {
      setRangeError(e instanceof Error ? e.message : 'Could not load that range.');
    } finally {
      setRangeBusy(false);
    }
  }

  const k = keyNumbers(snapshot, period, district);
  const where = districtName(snapshot, district);
  const summaries = useMemo(() => districtSummaries(snapshot, period), [snapshot, period]);
  const materials = materialsFor(snapshot, period, district);
  const series = monthlySeries(snapshot, period, district);
  const updated = snapshot.meta ? new Date(snapshot.meta.refreshed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'not yet';
  const selectedSummary = summaries.find((s) => s.key === district);

  const help = (id: HelpId): Help => ({ id, onAsk: setGuide });
  const periodLabel = periodText(period, range);
  const guideText = guide ? explainCard(guide, { where, isState: district === STATE, periodLabel, k, summaries, materials, series }) : '';

  return (
    <>
      {/* Filter bar */}
      <div className="sticky top-[57px] z-20 -mx-5 mb-8 border-b border-border/60 bg-background/90 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <div className="flex flex-wrap rounded-full bg-secondary p-1" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={period === p.id}
                onClick={() => setPeriod(p.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium ${period === p.id ? 'bg-primary text-white shadow-sm' : 'text-ink/70 hover:text-ink'}`}
              >
                {p.label}
              </button>
            ))}
            <DateRangePicker active={period === 'custom'} range={range} min={earliest} onApply={applyRange} />
          </div>
          <DistrictSelect
            value={district}
            onChange={setDistrict}
            options={[{ key: STATE, label: 'All of Perak' }, ...snapshot.districts.map((d) => ({ key: d.district_key, label: d.name }))]}
          />
          {rangeBusy && <span className="text-sm text-muted-foreground" role="status">Loading range…</span>}
          {rangeError && <span className="text-sm text-[#b45309]" role="alert">{rangeError}</span>}
          <span className="hidden text-sm text-muted-foreground sm:inline">Updated {updated}</span>
          <ReportPreview period={period} district={district} where={where} range={period === 'custom' ? range : null} />
        </div>
      </div>

      <div id="numbers" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={PackageCheck} label="Pickups completed" value={k.suppressed ? 'n/a' : <CountUp value={k.completed} />} note={k.suppressed ? 'Fewer than 5 households' : undefined} help={help('completed')} />
        <Stat icon={Home} label="Households taking part" value={k.suppressed ? 'n/a' : <CountUp value={k.households} />} help={help('households')} delay={70} />
        <Stat icon={Recycle} label="Items recycled" value={k.suppressed ? 'n/a' : <CountUp value={k.items} />} help={help('items')} delay={140} />
        <Stat icon={Gauge} label="Requests collected" delay={210} value={k.suppressed || k.rate === null ? 'n/a' : <CountUp value={k.rate * 100} format={(v) => `${Math.round(v)}%`} />} note={k.medianHours !== null ? `Usually claimed within ${k.medianHours} h` : undefined} help={help('rate')} />
      </div>

      {/* Map + selected area */}
      <div id="map" className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <Card
          delay={280}
          title="Where people recycle"
          help={help('map')}
          action={
            <button type="button" onClick={() => setShowTable((v) => !v)} aria-expanded={showTable} className="rounded-full px-3 py-1 text-sm text-primary hover:bg-secondary">
              {showTable ? 'Hide table' : 'Show as table'}
            </button>
          }
        >
          <DistrictMap snapshot={snapshot} period={period} selected={district} onSelect={setDistrict} />
          {showTable && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Pickups by district</caption>
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4 font-medium">District</th>
                    <th className="py-2 pr-4 font-medium">Requested</th>
                    <th className="py-2 pr-4 font-medium">Completed</th>
                    <th className="py-2 pr-4 font-medium">Not collected</th>
                    <th className="py-2 font-medium">Usual hours until claimed</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((s) => (
                    <tr key={s.key} className="border-t border-border">
                      <td className="py-2 pr-4">{s.name}</td>
                      <td className="py-2 pr-4 tabular-nums">{s.suppressed ? 'n/a' : s.requested}</td>
                      <td className="py-2 pr-4 tabular-nums">{s.suppressed ? 'n/a' : s.completed}</td>
                      <td className="py-2 pr-4 tabular-nums">{s.suppressed ? 'n/a' : s.unclaimed}</td>
                      <td className="py-2 tabular-nums">{s.suppressed || s.medianHours === null ? 'n/a' : s.medianHours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title={district === STATE ? 'Top districts' : where} help={help('side')} delay={320}>
          {district === STATE ? (
            <BarList
              selected={district}
              onSelect={setDistrict}
              items={summaries.slice(0, 8).map((s) => ({ key: s.key, label: s.name, value: s.suppressed ? null : s.completed }))}
            />
          ) : selectedSummary?.suppressed ? (
            <p className="text-sm text-muted-foreground">Fewer than 5 households here, so figures are hidden.</p>
          ) : (
            <dl className="space-y-4 text-sm">
              {[
                ['Requested', selectedSummary?.requested],
                ['Completed', selectedSummary?.completed],
                ['Not collected', selectedSummary?.unclaimed],
                ['Households', selectedSummary?.households],
              ].map(([l, v]) => (
                <div key={l as string} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
                  <dt className="text-muted-foreground">{l}</dt>
                  <dd className="text-xl font-bold tabular-nums">{v ?? 'n/a'}</dd>
                </div>
              ))}
            </dl>
          )}
          {district !== STATE && (
            <button type="button" onClick={() => setDistrict(STATE)} className="mt-5 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-primary hover:bg-[#dce8df]">
              Back to all of Perak
            </button>
          )}
        </Card>
      </div>

      <div id="charts" className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Pickups per month" help={help('monthly')} delay={360}>
          <MonthlyChart data={series} />
        </Card>
        <Card title="What is recycled" help={help('materials')} delay={400}>
          <BarList items={materials.map((m) => ({ key: m.name, label: titleCase(m.name), value: m.items, note: formatPct(m.share) }))} />
        </Card>
        <Card title="Pickups completed by district" help={help('districts')} delay={440}>
          <BarList selected={district} onSelect={setDistrict} items={summaries.map((s) => ({ key: s.key, label: s.name, value: s.suppressed ? null : s.completed }))} />
        </Card>
        <Card title="Requests not collected" help={help('unclaimed')} delay={480}>
          <BarList
            selected={district}
            onSelect={setDistrict}
            unit="%"
            items={[...summaries]
              .sort((a, b) => Number(a.suppressed) - Number(b.suppressed) || (b.unclaimedShare ?? 0) - (a.unclaimedShare ?? 0))
              .map((s) => ({
                key: s.key,
                label: s.name,
                value: s.suppressed || s.unclaimedShare === null ? null : Math.round(s.unclaimedShare * 100),
                note: s.suppressed ? undefined : `${s.unclaimed} of ${s.requested}`,
                tone: 'amber' as const,
              }))}
          />
        </Card>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Figures come from people using the SnapPick app. Any figure based on fewer than 5 households is hidden.{' '}
        {aiEnabled ? 'All insights and suggestions are AI-generated from real SnapPick data.' : 'All insights and suggestions are generated automatically from real SnapPick data.'}
      </p>

      <SnapBot period={period} district={district} range={period === 'custom' ? range : null} hidden={guide !== null} />
      {guide && <CardGuide target={guide} text={guideText} onClose={closeGuide} />}
    </>
  );
}
