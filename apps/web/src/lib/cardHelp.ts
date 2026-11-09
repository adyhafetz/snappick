import type { DistrictSummary, KeyNumbers } from './selectors';
import { formatPct, titleCase } from './selectors';

/** Everything an explanation may mention. All of it is already published, aggregate and suppression-checked. */
export interface HelpContext {
  where: string;
  isState: boolean;
  periodLabel: string;
  k: KeyNumbers;
  summaries: DistrictSummary[];
  materials: { name: string; items: number; share: number }[];
  series: { label: string; completed: number | null }[];
}

export type HelpId = 'completed' | 'households' | 'items' | 'rate' | 'map' | 'side' | 'monthly' | 'materials' | 'districts' | 'unclaimed';

const HIDDEN = 'Fewer than 5 households took part here, so the figure is hidden to protect privacy.';

export function explainCard(id: HelpId, c: HelpContext): string {
  const { k, where } = c;
  const span = c.periodLabel.toLowerCase();
  switch (id) {
    case 'completed':
      return k.suppressed
        ? `This counts pickups that finished. ${HIDDEN}`
        : `This counts pickups that finished in ${where} (${span}): the collector handed in a proof photo and the pickup was confirmed or completed on its own. Right now that is ${k.completed} out of ${k.requested} requests that reached an end.`;
    case 'households':
      return k.suppressed
        ? `This counts different households that asked for a pickup. ${HIDDEN}`
        : `This is how many different households asked for a pickup in ${where} (${span}). One household is counted once, however many times it asked. Now: ${k.households}.`;
    case 'items':
      return k.suppressed
        ? `This counts items in finished pickups. ${HIDDEN}`
        : `This adds up the items listed in the pickups that were completed in ${where} (${span}), such as bottles, boxes and cans. Now: ${k.items.toLocaleString('en-GB')}. These are counts from the requests, not weights.`;
    case 'rate':
      return k.suppressed
        ? `This compares finished pickups with all requests. ${HIDDEN}`
        : `Of the requests that ended in ${where} (${span}), ${formatPct(k.rate)} were completed. The rest were cancelled or expired before anyone collected them.${k.medianHours !== null ? ` Half of the claimed pickups were claimed within ${k.medianHours} hours.` : ''}`;
    case 'map':
      return `Each district is shaded by completed pickups: the lighter the colour, the fewer, and the darker, the more. Click a district to filter the whole page to it. Districts with fewer than 5 households stay a pale neutral colour, because their numbers are hidden.`;
    case 'side': {
      if (c.isState) {
        const top = c.summaries.find((s) => !s.suppressed && s.completed > 0);
        return `This ranks the districts with the most completed pickups (${span}).${top ? ` ${top.name} leads with ${top.completed}.` : ''} Click a name to look at that district.`;
      }
      return `This is the summary for ${where} (${span}): requests, completed pickups, requests nobody collected, and households taking part.`;
    }
    case 'monthly': {
      const shown = c.series.filter((s) => s.completed !== null);
      const best = shown.reduce<{ label: string; completed: number | null } | null>((b, s) => (b === null || (s.completed ?? 0) > (b.completed ?? 0) ? s : b), null);
      return `This line shows the pickups completed in ${where} in each month, so you can see whether participation is growing.${best && best.completed ? ` The busiest month shown is ${best.label} with ${best.completed}.` : ''} The latest month is marked "so far" because it is not finished yet.`;
    }
    case 'materials': {
      const top = c.materials[0];
      return `This shows which materials were in completed pickups in ${where} (${span}), shared by item count.${top ? ` ${titleCase(top.name)} is the biggest at ${formatPct(top.share)}.` : ''} It helps collectors and councils know what to expect.`;
    }
    case 'districts':
      return `Same ranking as the map, as bars: completed pickups for every district (${span}). Rows saying "Not enough data" have fewer than 5 households, so their numbers are hidden. Click a bar to focus the page on that district.`;
    case 'unclaimed': {
      const worst = [...c.summaries].filter((s) => !s.suppressed && s.unclaimedShare !== null).sort((a, b) => (b.unclaimedShare ?? 0) - (a.unclaimedShare ?? 0))[0];
      return `This is the share of requests that ended without a collector: cancelled or expired. A high share suggests the area needs more collectors.${worst && worst.unclaimedShare ? ` Highest now: ${worst.name} at ${formatPct(worst.unclaimedShare)} (${worst.unclaimed} of ${worst.requested}).` : ''}`;
    }
  }
}
