'use client';

import maplibregl from 'maplibre-gl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { districtSummaries } from '@/lib/selectors';
import { type Period, type Snapshot, STATE } from '@/lib/snapshot';

type Pos = [number, number];

function collect(coords: unknown, out: Pos[]) {
  if (Array.isArray(coords) && typeof coords[0] === 'number') out.push(coords as Pos);
  else if (Array.isArray(coords)) coords.forEach((c) => collect(c, out));
}

function boundsOf(s: Snapshot): maplibregl.LngLatBounds | null {
  const pts: Pos[] = [];
  s.districts.forEach((d) => collect((d.geojson as { coordinates?: unknown }).coordinates, pts));
  if (pts.length === 0) return null;
  const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
  pts.forEach((p) => b.extend(p));
  return b;
}

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function DistrictMap({
  snapshot,
  period,
  selected,
  onSelect,
}: {
  snapshot: Snapshot;
  period: Period;
  selected: string;
  onSelect: (key: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const summaries = useMemo(() => districtSummaries(snapshot, period), [snapshot, period]);
  const maxCompleted = Math.max(1, ...summaries.map((d) => d.completed));

  const districtsGeo = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: snapshot.districts.map((d) => {
        const sum = summaries.find((x) => x.key === d.district_key);
        return {
          type: 'Feature' as const,
          geometry: d.geojson,
          properties: {
            key: d.district_key,
            name: d.name,
            suppressed: sum?.suppressed ?? true,
            completed: sum?.completed ?? 0,
            unclaimed: sum?.unclaimed ?? 0,
            requested: sum?.requested ?? 0,
          },
        };
      }),
    }),
    [snapshot, summaries],
  );

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#f5f7f2' } }] },
      attributionControl: false,
      cooperativeGestures: true,
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    let loaded = false;
    const fit = () => {
      m.resize();
      const b = boundsOf(snapshotRef.current);
      if (b) m.fitBounds(b, { padding: 24, duration: 0 });
      m.triggerRepaint();
    };
    m.on('load', () => {
      m.addSource('districts', { type: 'geojson', data: districtsGeo });
      m.addLayer({
        id: 'district-fill',
        type: 'fill',
        source: 'districts',
        paint: {
          'fill-color': ['case', ['get', 'suppressed'], '#edf2ed', ['interpolate', ['linear'], ['get', 'completed'], 0, '#e8efe9', maxCompleted, '#19806d']],
          'fill-opacity': 1,
        },
      });
      m.addLayer({ id: 'district-line', type: 'line', source: 'districts', paint: { 'line-color': '#ffffff', 'line-width': 1.5 } });
      m.addLayer({
        id: 'district-selected',
        type: 'line',
        source: 'districts',
        filter: ['==', ['get', 'key'], ''],
        paint: { 'line-color': '#183e48', 'line-width': 2.5 },
      });
      const popup = new maplibregl.Popup({ closeButton: false, offset: 10 });
      m.on('click', 'district-fill', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { key: string; name: string; suppressed: boolean | string; completed: number; unclaimed: number };
        const hidden = p.suppressed === true || p.suppressed === 'true';
        onSelectRef.current(p.key);
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            hidden
              ? `<strong>${esc(p.name)}</strong><br/>Not enough data (fewer than 5 households)`
              : `<strong>${esc(p.name)}</strong><br/>${p.completed} completed · ${p.unclaimed} not collected`,
          )
          .addTo(m);
      });
      for (const layer of ['district-fill']) {
        m.on('mouseenter', layer, () => (m.getCanvas().style.cursor = 'pointer'));
        m.on('mouseleave', layer, () => (m.getCanvas().style.cursor = ''));
      }
      loaded = true;
      fit();
      requestAnimationFrame(fit);
      setTimeout(fit, 400);
      setReady(true);
    });
    // The container can change size after the first paint (layout, window resize), so refit the view then.
    const ro = new ResizeObserver(() => {
      if (loaded) fit();
    });
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      setReady(false);
    };
    // The map is created once; data and paint changes are applied in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource('districts') as maplibregl.GeoJSONSource).setData(districtsGeo);
    m.setPaintProperty('district-fill', 'fill-color', [
      'case',
      ['get', 'suppressed'],
      '#edf2ed',
      ['interpolate', ['linear'], ['get', 'completed'], 0, '#e8efe9', maxCompleted, '#19806d'],
    ]);
    m.setFilter('district-selected', ['==', ['get', 'key'], selected === STATE ? '' : selected]);
  }, [districtsGeo, maxCompleted, selected, ready]);

  function reset() {
    const b = boundsOf(snapshot);
    if (b && map.current) map.current.fitBounds(b, { padding: 24 });
    onSelect(STATE);
  }

  return (
    <div className="relative">
      <div ref={el} className="h-[420px] w-full overflow-hidden rounded-2xl border border-border" role="application" aria-label="Map of Perak districts" />
      <button type="button" onClick={reset} className="absolute left-3 top-3 rounded-full bg-white px-4 py-1.5 text-sm shadow hover:bg-secondary">
        Reset view
      </button>
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-4 rounded-xl bg-white/90 px-3 py-2 text-xs">
        <span className="flex items-center gap-2">
          Fewer
          <span className="h-2.5 w-24 rounded-full bg-gradient-to-r from-[#e8efe9] to-primary" />
          More pickups
        </span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-muted ring-1 ring-border" />Not enough data</span>
      </div>
    </div>
  );
}
