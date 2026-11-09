-- Public dashboard: aggregate statistics for a chosen date range.
-- Same rules as refresh_public_stats(): only requests that reached a final outcome, a district or Perak as a whole,
-- and any figure based on fewer than 5 households is returned as null (suppressed). No user ids, notes, addresses,
-- images or coordinates leave the database. The range must be 7 to 1100 days long and cannot end in the future.
-- Dates are read as Malaysia time.

create or replace function public.get_public_range_stats(p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_from timestamptz;
  v_to timestamptz;
  v jsonb;
begin
  if p_from is null or p_to is null or p_to - p_from < 6 or p_to - p_from > 1100
     or p_to > (now() at time zone 'Asia/Kuala_Lumpur')::date then
    raise exception 'Choose a range of at least 7 days that ends today or earlier.' using errcode = '22023';
  end if;
  v_from := p_from::timestamp at time zone 'Asia/Kuala_Lumpur';
  v_to := (p_to + 1)::timestamp at time zone 'Asia/Kuala_Lumpur';

  with b as (
    select r.id, r.requester_id, r.status, r.created_at, r.claimed_at, d.slug as dk
    from public.pickup_requests_public r
    join public.perak_districts d on d.id = r.district_id
    where r.status in ('completed', 'not_collected', 'cancelled', 'expired')
      and r.created_at >= v_from and r.created_at < v_to
  ), agg as (
    select coalesce(dk, 'state') as dk,
           count(*)::int as requested,
           count(*) filter (where status = 'completed')::int as completed,
           count(*) filter (where status in ('cancelled', 'expired'))::int as unclaimed,
           count(distinct requester_id)::int as households,
           (percentile_cont(0.5) within group (order by extract(epoch from claimed_at - created_at) / 3600)
              filter (where claimed_at is not null))::numeric as med
    from b
    group by grouping sets ((dk), ())
  ), it as (
    select coalesce(b.dk, 'state') as dk, i.app_class,
           sum(coalesce(i.collector_quantity, i.requester_quantity))::int as items
    from b
    join public.pickup_waste_items i on i.request_id = b.id and i.accepted
    where b.status = 'completed'
    group by grouping sets ((b.dk, i.app_class), (i.app_class))
  ), itt as (
    select dk, sum(items)::int as items from it group by dk
  )
  select jsonb_build_object(
    'period', coalesce((
      select jsonb_agg(jsonb_build_object(
        'period', 'custom',
        'district_key', a.dk,
        'requested', case when a.households >= 5 then a.requested end,
        'completed', case when a.households >= 5 then a.completed end,
        'unclaimed', case when a.households >= 5 then a.unclaimed end,
        'households', a.households,
        'items_recycled', case when a.households >= 5 then coalesce(t.items, 0) end,
        'median_claim_hours', case when a.households >= 5 then round(a.med, 1) end,
        'suppressed', a.households < 5))
      from agg a left join itt t on t.dk = a.dk), '[]'::jsonb),
    'materials', coalesce((
      select jsonb_agg(jsonb_build_object('period', 'custom', 'district_key', i.dk, 'app_class', i.app_class, 'items', i.items))
      from it i join agg a on a.dk = i.dk and a.households >= 5), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

revoke all on function public.get_public_range_stats(date, date) from public;
grant execute on function public.get_public_range_stats(date, date) to anon, authenticated, service_role;
