import { districtName, districtSummaries, formatPct, keyNumbers, materialsFor, titleCase } from './selectors';
import { type Period, type Snapshot, STATE } from './snapshot';

export type InsightGroup = 'Quick wins' | 'Service coverage' | 'Policy and enforcement context';
export interface Insight {
  group: InsightGroup;
  text: string;
}

/**
 * Rule-based suggestions written from the published aggregates only. Every sentence cites the figure it uses.
 * A language model may rephrase them later, but it never sees anything beyond these numbers.
 */
export function buildInsights(s: Snapshot, period: Period, key: string = STATE): Insight[] {
  const k = keyNumbers(s, period, key);
  const where = districtName(s, key);
  if (k.suppressed) {
    return [
      {
        group: 'Quick wins',
        text: `${where} has fewer than 5 participating households in this period, so its figures are hidden. Encouraging more households to join is the first step.`,
      },
    ];
  }
  const out: Insight[] = [];
  out.push({
    group: 'Policy and enforcement context',
    text: `${k.households} households in ${where} asked for ${k.requested} pickups and ${k.completed} (${formatPct(k.rate)}) were completed, with no obligation to take part.`,
  });

  const top = materialsFor(s, period, key)[0];
  if (top) {
    out.push({
      group: 'Quick wins',
      text: `${titleCase(top.name)} is the most recycled material (${formatPct(top.share)} of ${k.items.toLocaleString('en-GB')} items). Simple guidance on keeping it clean and dry would make pickups easier.`,
    });
  }

  if (key === STATE) {
    const rows = districtSummaries(s, period);
    const gaps = rows
      .filter((r) => r.unclaimedShare !== null && r.requested >= 10)
      .sort((a, b) => (b.unclaimedShare ?? 0) - (a.unclaimedShare ?? 0));
    const worst = gaps[0];
    if (worst && (worst.unclaimedShare ?? 0) > 0.15) {
      out.push({
        group: 'Service coverage',
        text: `${worst.name}: ${worst.unclaimed} of ${worst.requested} requests (${formatPct(worst.unclaimedShare)}) were not collected. A regular collection day or more local collectors would close this gap.`,
      });
    }
    const slow = rows
      .filter((r) => r.medianHours !== null)
      .sort((a, b) => (b.medianHours ?? 0) - (a.medianHours ?? 0))[0];
    if (slow && slow.medianHours !== null) {
      out.push({
        group: 'Service coverage',
        text: `Requests in ${slow.name} wait the longest to be claimed (median ${slow.medianHours} hours; Perak overall ${k.medianHours ?? 'n/a'} hours).`,
      });
    }
    const hidden = rows.filter((r) => r.suppressed);
    if (hidden.length > 0) {
      out.push({
        group: 'Quick wins',
        text: `${hidden.length} district${hidden.length === 1 ? ' has' : 's have'} fewer than 5 households (${hidden.map((h) => h.name).join(', ')}). Local awareness campaigns there would make their figures reportable.`,
      });
    }
  } else if (k.unclaimed > 0) {
    out.push({
      group: 'Service coverage',
      text: `${k.unclaimed} of ${k.requested} requests in ${where} were not collected${k.medianHours !== null ? `; claimed requests waited a median of ${k.medianHours} hours` : ''}.`,
    });
  }
  return out;
}
