import { buildInsights } from './insights';
import { districtName, districtSummaries, formatPct, keyNumbers, materialsFor, monthlySeries } from './selectors';
import { type Period, periodText, type Snapshot, STATE } from './snapshot';

/** The only data SnapBot and the report writer may use: published aggregates, never anything else. */
export function buildFacts(s: Snapshot, period: Period, key: string) {
  const k = keyNumbers(s, period, key);
  return {
    scope: districtName(s, key),
    period: periodText(period, s.range),
    updated: s.meta?.refreshed_at ?? null,
    totals: k.suppressed ? 'hidden: fewer than 5 households' : k,
    materials: materialsFor(s, period, key).map((m) => ({ material: m.name, items: m.items, share: formatPct(m.share) })),
    monthlyCompleted: monthlySeries(s, period, key).map((m) => ({ month: m.label, completed: m.completed })),
    districts: districtSummaries(s, period).map((d) =>
      d.suppressed
        ? { district: d.name, figures: 'hidden: fewer than 5 households' }
        : { district: d.name, requested: d.requested, completed: d.completed, notCollected: d.unclaimed, notCollectedShare: formatPct(d.unclaimedShare), medianHoursToClaim: d.medianHours },
    ),
    suggestions: buildInsights(s, period, key).map((i) => i.text),
  };
}

const ANSWERS: { test: RegExp; make: (s: Snapshot, period: Period, key: string) => string }[] = [
  {
    test: /(which|what).*(district|area).*(help|need|worst|gap)|need.*help|biggest gap/i,
    make: (s, p) => {
      const rows = districtSummaries(s, p).filter((d) => !d.suppressed && d.requested >= 10).sort((a, b) => (b.unclaimedShare ?? 0) - (a.unclaimedShare ?? 0));
      const w = rows[0];
      return w
        ? `${w.name} has the largest gap: ${w.unclaimed} of ${w.requested} requests (${formatPct(w.unclaimedShare)}) were not collected. Districts with fewer than 5 households are hidden, so some small areas may also need help.`
        : 'There is not enough data yet to name one district.';
    },
  },
  {
    test: /first|priority|recommend|suggest|should we do/i,
    make: (s, p, k) => buildInsights(s, p, k).map((i) => `• ${i.text}`).join('\n'),
  },
  {
    test: /chart|mean|read|explain|how/i,
    make: () =>
      'The area chart shows completed pickups each month. The bars show recycled materials and which districts completed the most pickups. Amber bars show requests that nobody collected. "Not enough data" means fewer than 5 households, so the figure is hidden to protect privacy.',
  },
  {
    test: /material|plastic|paper|glass|metal|cardboard|recycle/i,
    make: (s, p, k) => {
      const m = materialsFor(s, p, k).slice(0, 3);
      return m.length ? `Most recycled in ${districtName(s, k)}: ${m.map((x) => `${x.name} (${formatPct(x.share)})`).join(', ')}.` : 'No material data for this selection yet.';
    },
  },
];

/** Used when no language-model key is configured: simple keyword rules over the same aggregates. */
export function ruleAnswer(question: string, s: Snapshot, period: Period, key: string = STATE): string {
  const hit = ANSWERS.find((a) => a.test.test(question));
  if (hit) return hit.make(s, period, key);
  const k = keyNumbers(s, period, key);
  if (k.suppressed) return `There are fewer than 5 households in ${districtName(s, key)}, so I cannot show figures for it.`;
  return `In ${districtName(s, key)}, ${k.households} households requested ${k.requested} pickups and ${k.completed} were completed. Ask me about materials, districts that need help, or what to do first.`;
}
