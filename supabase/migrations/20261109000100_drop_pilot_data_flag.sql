-- The dashboard no longer needs to know whether sample (pilot) data exists, so the flag is removed.
-- refresh_public_stats() is re-created without it first, then the column is dropped.

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

  insert into public.public_meta (id, refreshed_at, snapshot_hash)
  values (true, now(),
          md5(coalesce((select string_agg(p::text, '|' order by p.period, p.district_key) from public.public_stats_period p), '')))
  on conflict (id) do update
    set refreshed_at = excluded.refreshed_at, snapshot_hash = excluded.snapshot_hash;
end;
$$;
revoke all on function public.refresh_public_stats() from public, anon, authenticated;
grant execute on function public.refresh_public_stats() to service_role;

alter table public.public_meta drop column has_pilot_data;

select public.refresh_public_stats();
