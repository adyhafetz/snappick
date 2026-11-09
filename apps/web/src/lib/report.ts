import PDFDocument from 'pdfkit';
import { buildInsights, type Insight, type InsightGroup } from './insights';
import { districtName, districtSummaries, formatPct, keyNumbers, materialsFor, monthlySeries, titleCase } from './selectors';
import { type Period, periodText, type Snapshot } from './snapshot';

const INK = '#183e48';
const PRIMARY = '#19806d';
const AMBER = '#e7b73e';
const MUTED = '#5b7072';
const MINT = '#e8efe9';
const GROUPS: InsightGroup[] = ['Quick wins', 'Service coverage', 'Policy and enforcement context'];

/** `aiInsights` are model-written recommendations; when absent the rule-based ones are used and labelled as automatic. */
export function buildReport(s: Snapshot, period: Period, key: string, aiInsights?: Insight[] | null, logo?: Buffer): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 72, bottom: 64, left: 56, right: 56 }, bufferPages: true, info: { Title: 'SnapPick report', Author: 'SnapPick' } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const k = keyNumbers(s, period, key);
  const where = districtName(s, key);
  const periodLabel = periodText(period, s.range);
  const generated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const dataDate = s.meta ? new Date(s.meta.refreshed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'not available';
  const W = doc.page.width - 112;

  const h1 = (t: string) => {
    ensure(80);
    doc.moveDown(0.8).font('Helvetica-Bold').fontSize(16).fillColor(INK).text(t);
    doc.moveTo(56, doc.y + 2).lineTo(56 + 48, doc.y + 2).lineWidth(3).strokeColor(PRIMARY).stroke();
    doc.moveDown(0.8);
  };
  const p = (t: string, size = 10.5) => doc.font('Helvetica').fontSize(size).fillColor(INK).text(t, { width: W, lineGap: 3 }).moveDown(0.5);
  const small = (t: string) => doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(t, { width: W }).moveDown(0.4);
  function ensure(h: number) {
    if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage();
  }

  function bars(items: { label: string; value: number | null; note?: string; color?: string }[]) {
    const max = Math.max(1, ...items.map((i) => i.value ?? 0));
    for (const it of items) {
      ensure(22);
      const y = doc.y;
      doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(it.label, 56, y + 2, { width: 120 });
      doc.roundedRect(180, y + 3, 230, 9, 4).fill(MINT);
      if (it.value !== null) doc.roundedRect(180, y + 3, Math.max(4, (it.value / max) * 230), 9, 4).fill(it.color ?? PRIMARY);
      doc.font('Helvetica').fontSize(9.5).fillColor(it.value === null ? MUTED : INK).text(it.value === null ? 'Not enough data' : `${it.value.toLocaleString('en-GB')}${it.note ? `  ${it.note}` : ''}`, 420, y + 2, { width: W - 364 });
      doc.y = y + 20;
    }
    doc.x = 56;
  }

  function table(head: string[], rows: string[][], widths: number[]) {
    const draw = (cells: string[], bold: boolean, fill?: string) => {
      ensure(22);
      const y = doc.y;
      if (fill) doc.rect(56, y - 3, W, 19).fill(fill);
      let x = 56;
      cells.forEach((c, i) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(INK).text(c, x + 4, y, { width: widths[i] - 8, lineBreak: false });
        x += widths[i];
      });
      doc.y = y + 19;
    };
    draw(head, true, MINT);
    rows.forEach((r) => draw(r, false));
    doc.x = 56;
    doc.moveDown(0.5);
  }

  // Cover
  if (logo) doc.image(logo, 56, 72, { width: 56 });
  doc.font('Helvetica-Bold').fontSize(30).fillColor(INK).text('Recycling Participation in Perak', 56, 190, { width: W });
  doc.font('Helvetica').fontSize(18).fillColor(PRIMARY).text('Community Report', 56, doc.y + 6);
  doc.moveDown(2).font('Helvetica').fontSize(11).fillColor(INK);
  doc.text(`Area: ${where}`).text(`Period: ${periodLabel}`).text(`Data up to: ${dataDate}`).text(`Generated: ${generated}`);
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('SnapPick · Android app for recycling pickups in Perak', 56, doc.page.height - 100);

  // Summary
  doc.addPage();
  h1('Summary');
  if (k.suppressed) {
    p(`${where} has fewer than 5 participating households in this period, so its figures are hidden to protect privacy.`);
  } else {
    const stat = (label: string, value: string, x: number) => {
      const y = doc.y;
      doc.roundedRect(x, y, 118, 62, 10).fill(MINT);
      doc.font('Helvetica-Bold').fontSize(20).fillColor(PRIMARY).text(value, x + 10, y + 10, { width: 100 });
      doc.font('Helvetica').fontSize(8.5).fillColor(INK).text(label, x + 10, y + 40, { width: 100 });
    };
    const y0 = doc.y;
    stat('Pickups completed', k.completed.toLocaleString('en-GB'), 56);
    doc.y = y0;
    stat('Households taking part', k.households.toLocaleString('en-GB'), 56 + 125);
    doc.y = y0;
    stat('Items recycled', k.items.toLocaleString('en-GB'), 56 + 250);
    doc.y = y0;
    stat('Completion rate', formatPct(k.rate), 56 + 375);
    doc.x = 56;
    doc.y = y0 + 80;
    p('Key findings', 12);
    buildInsights(s, period, key).slice(0, 3).forEach((i) => p(`• ${i.text}`));
  }

  h1('Method and data notes');
  p('What is counted: pickup requests that reached a final outcome (completed, not collected, cancelled or expired). Households are counted by distinct requesting accounts. Items are the quantities collectors confirmed.');
  p('Privacy: figures are aggregated. Any figure based on fewer than 5 households is hidden. Map areas are about 5 km wide and show no addresses or exact locations. No names, photos or personal details are used here.');
  p('Limits: the data comes from people who chose to use the SnapPick app . It does not describe all households in Perak.');

  // Participation
  const series = monthlySeries(s, period, key);
  h1('Participation');
  bars(series.map((m) => ({ label: m.label, value: m.completed })));
  small('Completed pickups per month. "Not enough data" means fewer than 5 households that month.');

  // Materials
  h1('Materials');
  const mats = materialsFor(s, period, key);
  bars(mats.map((m) => ({ label: titleCase(m.name), value: m.items, note: formatPct(m.share) })));
  small('Items recycled by material and share of all items.');

  // Districts
  h1('Districts');
  const rows = districtSummaries(s, period);
  table(
    ['District', 'Requested', 'Completed', 'Not collected', 'Median h to claim'],
    rows.map((r) => (r.suppressed ? [r.name, 'n/a', 'n/a', 'n/a', 'n/a'] : [r.name, String(r.requested), String(r.completed), String(r.unclaimed), r.medianHours === null ? 'n/a' : String(r.medianHours)])),
    [150, 80, 80, 90, 95],
  );
  small('n/a: fewer than 5 households, figure hidden.');

  // Gaps
  h1('Service gaps');
  const gaps = rows.filter((r) => !r.suppressed && r.requested > 0).sort((a, b) => (b.unclaimedShare ?? 0) - (a.unclaimedShare ?? 0));
  bars(gaps.map((g) => ({ label: g.name, value: g.unclaimed, note: formatPct(g.unclaimedShare), color: AMBER })));
  small('Requests that nobody collected (cancelled or expired), with their share of the district\'s requests.');

  // Recommendations
  h1(aiInsights ? 'Recommendations (AI-written)' : 'Recommendations');
  small(
    aiInsights
      ? `Written by AI from the published figures up to ${dataDate}. These are suggestions, not official policy.`
      : `Generated automatically from the published figures up to ${dataDate}. These are suggestions, not official policy.`,
  );
  const insights = aiInsights ?? buildInsights(s, period, key);
  for (const g of GROUPS) {
    const items = insights.filter((i) => i.group === g);
    if (!items.length) continue;
    ensure(50);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(PRIMARY).text(g);
    doc.moveDown(0.2);
    items.forEach((i) => p(`• ${i.text}`));
  }

  // Appendix
  h1('Appendix');
  p('Definitions. Requested: pickup requests that reached a final outcome. Completed: items handed over and confirmed. Not collected: cancelled or expired requests that nobody collected. Median hours to claim: the middle waiting time between a request and a collector accepting it.');
  p(`Source: SnapPick app activity, published as aggregate statistics on ${dataDate}.`);

  // Header and footer on every page after the cover
  const range = doc.bufferedPageRange();
  for (let i = 1; i < range.count; i++) {
    doc.switchToPage(i);
    // The footer sits inside the bottom margin; without this, pdfkit adds a new blank page for every footer line.
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
    doc.text('SnapPick · Report', 56, 36, { width: W, lineBreak: false });
    doc.text(aiInsights ? 'All insights and suggestions are AI-generated from real SnapPick data.' : 'All insights and suggestions are generated automatically from real SnapPick data.', 56, doc.page.height - 44, { width: W - 90, lineBreak: false });
    doc.text(`Page ${i + 1} of ${range.count}`, 56, doc.page.height - 44, { width: W, align: 'right', lineBreak: false });
  }
  doc.end();
  return done;
}
