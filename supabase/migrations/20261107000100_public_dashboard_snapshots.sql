-- Public dashboard: published aggregate snapshots only.
-- The public website reads these tables (anon) and nothing else. Every aggregate based on fewer than
-- 5 households is suppressed (numbers stored as null, suppressed = true). Hotspot cells with fewer than
-- 5 households are not published at all. No user ids, notes, addresses, images, exact coordinates or
-- sub-day timestamps are stored here. Only terminal pickups count.

create table public.public_meta (
  id boolean primary key default true check (id),
  refreshed_at timestamptz not null,
  has_pilot_data boolean not null,
  snapshot_hash text not null
);

-- district_key is a district slug, or 'state' for the whole of Perak.
create table public.public_stats_period (
  period text not null check (period in ('30d', '90d', 'all')),
  district_key text not null,
  requested int,
  completed int,
  unclaimed int,
  households int not null,
  items_recycled int,
  median_claim_hours numeric(6, 1),
  suppressed boolean not null,
  primary key (period, district_key)
);

create table public.public_stats_monthly (
  district_key text not null,
  month date not null,
  requested int,
  completed int,
  unclaimed int,
  households int not null,
  suppressed boolean not null,
  primary key (district_key, month)
);

create table public.public_stats_materials (
  period text not null check (period in ('30d', '90d', 'all')),
  district_key text not null,
  app_class text not null,
  items int not null,
  primary key (period, district_key, app_class)
);

-- Cell centres of a 0.05 degree grid (about 5 km). Never a real point.
create table public.public_stats_hotspots (
  period text not null check (period in ('30d', '90d', 'all')),
  cell_id text not null,
  district_key text not null,
  lon numeric(8, 3) not null,
  lat numeric(8, 3) not null,
  requests int not null,
  completed int not null,
  unclaimed int not null,
  primary key (period, cell_id)
);

alter table public.public_meta enable row level security;
alter table public.public_stats_period enable row level security;
alter table public.public_stats_monthly enable row level security;
alter table public.public_stats_materials enable row level security;
alter table public.public_stats_hotspots enable row level security;

create policy public_meta_read on public.public_meta for select to anon, authenticated using (true);
create policy public_stats_period_read on public.public_stats_period for select to anon, authenticated using (true);
create policy public_stats_monthly_read on public.public_stats_monthly for select to anon, authenticated using (true);
create policy public_stats_materials_read on public.public_stats_materials for select to anon, authenticated using (true);
create policy public_stats_hotspots_read on public.public_stats_hotspots for select to anon, authenticated using (true);

revoke all on public.public_meta, public.public_stats_period, public.public_stats_monthly,
  public.public_stats_materials, public.public_stats_hotspots from anon, authenticated;
grant select on public.public_meta, public.public_stats_period, public.public_stats_monthly,
  public.public_stats_materials, public.public_stats_hotspots to anon, authenticated;

-- District outlines for the public map (simplified; boundaries are public information).
create or replace function public.get_public_districts()
returns table (district_key text, name text, geojson jsonb)
language sql stable security definer set search_path = public, extensions as $$
  select d.slug, d.name, st_asgeojson(st_simplifypreservetopology(d.boundary, 0.003))::jsonb
  from public.perak_districts d
  where not d.is_placeholder
  order by d.name;
$$;
revoke all on function public.get_public_districts() from public;
grant execute on function public.get_public_districts() to anon, authenticated, service_role;

create or replace function public.refresh_public_stats()
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  create temp table _w (period text, since timestamptz) on commit drop;
  insert into _w values ('30d', now() - interval '30 days'), ('90d', now() - interval '90 days'), ('all', '-infinity');

  create temp table _b on commit drop as
  select r.id, r.requester_id, r.status, r.created_at, r.claimed_at, d.slug as dk, r.approximate_location as loc
  from public.pickup_requests_public r
  join public.perak_districts d on d.id = r.district_id
  where r.status in ('completed', 'not_collected', 'cancelled', 'expired');

  create temp table _bp on commit drop as
  select w.period, b.* from _b b join _w w on b.created_at >= w.since;

  delete from public.public_stats_period;
  delete from public.public_stats_monthly;
  delete from public.public_stats_materials;
  delete from public.public_stats_hotspots;

  create temp table _items on commit drop as
  select bp.period, coalesce(bp.dk, 'state') as dk, i.app_class,
         sum(coalesce(i.collector_quantity, i.requester_quantity))::int as items
  from _bp bp
  join public.pickup_waste_items i on i.request_id = bp.id and i.accepted
  where bp.status = 'completed'
  group by grouping sets ((bp.period, bp.dk, i.app_class), (bp.period, i.app_class));

  with agg as (
    select period, coalesce(dk, 'state') as dk,
           count(*)::int as requested,
           count(*) filter (where status = 'completed')::int as completed,
           count(*) filter (where status in ('cancelled', 'expired'))::int as unclaimed,
           count(distinct requester_id)::int as households,
           (percentile_cont(0.5) within group (order by extract(epoch from claimed_at - created_at) / 3600)
              filter (where claimed_at is not null))::numeric as med
    from _bp
    group by grouping sets ((period, dk), (period))
  ), it as (
    select period, dk, sum(items)::int as items from _items group by period, dk
  )
  insert into public.public_stats_period
  select a.period, a.dk,
         case when a.households >= 5 then a.requested end,
         case when a.households >= 5 then a.completed end,
         case when a.households >= 5 then a.unclaimed end,
         a.households,
         case when a.households >= 5 then coalesce(it.items, 0) end,
         case when a.households >= 5 then round(a.med, 1) end,
         a.households < 5
  from agg a left join it on it.period = a.period and it.dk = a.dk;

  insert into public.public_stats_materials
  select i.period, i.dk, i.app_class, i.items
  from _items i
  join public.public_stats_period p on p.period = i.period and p.district_key = i.dk and not p.suppressed;

  insert into public.public_stats_monthly
  select coalesce(dk, 'state'), date_trunc('month', created_at)::date as month,
         case when count(distinct requester_id) >= 5 then count(*)::int end,
         case when count(distinct requester_id) >= 5 then (count(*) filter (where status = 'completed'))::int end,
         case when count(distinct requester_id) >= 5 then (count(*) filter (where status in ('cancelled', 'expired')))::int end,
         count(distinct requester_id)::int,
         count(distinct requester_id) < 5
  from _b
  group by grouping sets ((dk, date_trunc('month', created_at)), (date_trunc('month', created_at)));

  insert into public.public_stats_hotspots
  select period, cell, coalesce(max(dk), 'unknown'), lon, lat,
         count(*)::int, (count(*) filter (where status = 'completed'))::int,
         (count(*) filter (where status in ('cancelled', 'expired')))::int
  from (
    select bp.period, bp.dk, bp.status, bp.requester_id,
           floor(st_x(bp.loc) / 0.05)::int || ':' || floor(st_y(bp.loc) / 0.05)::int as cell,
           round(((floor(st_x(bp.loc) / 0.05) + 0.5) * 0.05)::numeric, 3) as lon,
           round(((floor(st_y(bp.loc) / 0.05) + 0.5) * 0.05)::numeric, 3) as lat
    from _bp bp where bp.loc is not null
  ) c
  group by period, cell, lon, lat
  having count(distinct requester_id) >= 5;

  insert into public.public_meta (id, refreshed_at, has_pilot_data, snapshot_hash)
  values (true, now(),
          exists (select 1 from auth.users where email like '%@pilot.snappick.test'),
          md5(coalesce((select string_agg(p::text, '|' order by p.period, p.district_key) from public.public_stats_period p), '')))
  on conflict (id) do update
    set refreshed_at = excluded.refreshed_at, has_pilot_data = excluded.has_pilot_data, snapshot_hash = excluded.snapshot_hash;
end;
$$;
revoke all on function public.refresh_public_stats() from public, anon, authenticated;
grant execute on function public.refresh_public_stats() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('refresh-public-stats', '5 * * * *', 'select public.refresh_public_stats();');
  end if;
end $$;

select public.refresh_public_stats();
