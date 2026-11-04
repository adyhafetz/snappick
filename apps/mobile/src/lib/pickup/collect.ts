export type MarketplaceRequest = {
  id: string;
  district_name: string | null;
  material_summary: { class?: string; quantity?: number }[];
  pickup_window_start: string | null;
  pickup_window_end: string | null;
  longitude: number;
  latitude: number;
  cell_count: number;
  is_mine?: boolean;
};

export type MarketplaceCell = {
  key: string;
  coordinate: [number, number];
  count: number;
  hasMine: boolean;
  requests: MarketplaceRequest[];
};

export function groupMarketplaceRequests(rows: MarketplaceRequest[]): MarketplaceCell[] {
  const cells = new Map<string, MarketplaceCell>();
  for (const row of rows) {
    if (!Number.isFinite(row.longitude) || !Number.isFinite(row.latitude)) continue;
    const key = `${row.longitude.toFixed(2)},${row.latitude.toFixed(2)}`;
    const cell = cells.get(key) ?? {
      key,
      coordinate: [row.longitude, row.latitude],
      count: row.cell_count,
      hasMine: false,
      requests: [],
    };
    cell.requests.push(row);
    if (row.is_mine) {
      cell.hasMine = true;
    }
    cells.set(key, cell);
  }
  return [...cells.values()];
}

export function formatPickupSummary(summary: MarketplaceRequest['material_summary']): string {
  if (!Array.isArray(summary) || summary.length === 0) return 'Materials unavailable';
  return summary.map((item) => `${item.quantity ?? 1} x ${item.class ?? 'item'}`).join(', ');
}

export function formatPickupWindow(start: string | null, end: string | null): string {
  if (!start || !end) return 'Pickup window unavailable';
  const from = new Date(start);
  const until = new Date(end);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(until.getTime())) return 'Pickup window unavailable';
  return `${from.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}, ${from.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}-${until.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}
