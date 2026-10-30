-- Phase 13: Public Aggregate Views for Web Dashboard
-- Strictly adheres to privacy-by-design:
-- 1. No PII, exact coordinates, unit numbers, phone numbers, or user IDs are exposed.
-- 2. Small-count suppression: district counts < 5 are masked/suppressed.
-- 3. Anonymous role is granted SELECT ONLY on these aggregate views; base tables remain locked.

-- 1. Overview KPIs
create or replace view public.dashboard_overview_kpis as
select
  count(distinct p.id)::int as total_pickups,
  count(distinct p.id) filter (where p.status = 'completed')::int as completed_pickups,
  count(distinct p.id) filter (where p.status = 'pending')::int as pending_pickups,
  count(distinct p.id) filter (where p.status in ('accepted', 'in_progress', 'awaiting_confirmation'))::int as in_progress_pickups,
  case 
    when count(distinct p.id) > 0 
    then round((count(distinct p.id) filter (where p.status = 'completed')::numeric / count(distinct p.id)::numeric) * 100, 1)
    else 0.0 
  end as completion_rate_percent,
  coalesce(sum(wi.requester_quantity) filter (where p.status = 'completed' and wi.accepted = true), 0)::int as total_items_recycled,
  count(distinct p.collector_id) filter (where p.status = 'completed')::int as active_collectors,
  count(distinct p.requester_id)::int as participating_households,
  (select count(*)::int from public.scans) as total_ai_scans,
  coalesce(
    round(
      avg(extract(epoch from (p.updated_at - p.claimed_at)) / 3600.0) 
      filter (where p.status = 'completed' and p.claimed_at is not null)::numeric, 1
    ), 
    0.0
  ) as avg_fulfillment_hours,
  now() as generated_at
from public.pickup_requests_public p
left join public.pickup_waste_items wi on wi.request_id = p.id;

-- 2. Material Breakdown
create or replace view public.dashboard_material_breakdown as
with material_counts as (
  select
    wi.app_class as material_family,
    count(distinct p.id)::int as pickup_count,
    sum(wi.requester_quantity)::int as total_items,
    sum(case 
      when wi.app_class = 'cardboard' then wi.requester_quantity * 0.5
      when wi.app_class = 'glass' then wi.requester_quantity * 0.4
      when wi.app_class = 'metal' then wi.requester_quantity * 0.1
      when wi.app_class = 'paper' then wi.requester_quantity * 0.2
      when wi.app_class = 'plastic' then wi.requester_quantity * 0.08
      else wi.requester_quantity * 0.1
    end)::numeric(10, 2) as estimated_kg
  from public.pickup_waste_items wi
  join public.pickup_requests_public p on p.id = wi.request_id
  where wi.accepted = true
  group by wi.app_class
),
total_summary as (
  select coalesce(sum(total_items), 0) as grand_total_items from material_counts
)
select
  mc.material_family,
  mc.pickup_count,
  mc.total_items,
  mc.estimated_kg,
  case 
    when ts.grand_total_items > 0 
    then round((mc.total_items::numeric / ts.grand_total_items::numeric) * 100, 1)
    else 0.0 
  end as share_percent
from material_counts mc
cross join total_summary ts
order by mc.total_items desc;

-- 3. Pickup Trends (Daily Aggregation over past 90 days)
create or replace view public.dashboard_pickup_trends as
select
  date_trunc('day', p.created_at)::date as period_date,
  count(distinct p.id)::int as total_requests,
  count(distinct p.id) filter (where p.status = 'completed')::int as completed_requests,
  count(distinct p.id) filter (where p.status = 'pending')::int as pending_requests,
  coalesce(sum(wi.requester_quantity) filter (where wi.accepted = true), 0)::int as items_requested
from public.pickup_requests_public p
left join public.pickup_waste_items wi on wi.request_id = p.id
where p.created_at >= (now() - interval '90 days')
group by date_trunc('day', p.created_at)::date
order by period_date asc;

-- 4. District Aggregates with Small-Count Suppression (< 5 masked for privacy)
create or replace view public.dashboard_district_aggregates as
select
  d.id as district_id,
  d.name as district_name,
  d.slug as district_slug,
  case 
    when count(distinct p.id) >= 5 then count(distinct p.id)::int 
    else null 
  end as total_pickups,
  case 
    when count(distinct p.id) >= 5 then count(distinct p.id) filter (where p.status = 'completed')::int 
    else null 
  end as completed_pickups,
  case 
    when count(distinct p.id) >= 5 then coalesce(sum(wi.requester_quantity) filter (where wi.accepted = true), 0)::int 
    else null 
  end as total_items,
  (count(distinct p.id) < 5) as is_suppressed,
  case 
    when count(distinct p.id) < 5 then '< 5' 
    else count(distinct p.id)::text 
  end as display_count,
  extensions.st_x(extensions.st_centroid(d.boundary)) as center_lng,
  extensions.st_y(extensions.st_centroid(d.boundary)) as center_lat
from public.perak_districts d
left join public.pickup_requests_public p on p.district_id = d.id
left join public.pickup_waste_items wi on wi.request_id = p.id
where not d.is_placeholder
group by d.id, d.name, d.slug, d.boundary
order by d.name asc;

-- 5. Model Transparency View
create or replace view public.dashboard_model_transparency as
select
  mv.id,
  mv.version,
  mv.role,
  mv.status,
  mv.rollout_percent,
  mv.sha256,
  mv.size_bytes,
  coalesce(
    (mv.metrics->>'golden_map50_95')::numeric,
    (mv.metrics->>'map50_95')::numeric,
    0.0
  ) as golden_map50_95,
  coalesce(
    (mv.metrics->>'golden_map50')::numeric,
    (mv.metrics->>'map50')::numeric,
    0.0
  ) as golden_map50,
  coalesce(
    (mv.metrics->>'test_map50_95')::numeric,
    0.0
  ) as test_map50_95,
  coalesce(
    (mv.metrics->>'mean_inference_ms')::numeric,
    (mv.manifest->'benchmark'->>'mean_inference_ms')::numeric,
    null
  ) as mean_inference_ms,
  mv.min_app_version,
  mv.manifest->'input'->>'size' as input_size,
  mv.model_card,
  (mv.role = 'champion' and mv.status in ('approved', 'rolling_out', 'stable')) as is_champion,
  (mv.role = 'bundled_fallback') as is_bundled_fallback,
  mv.created_at
from public.model_versions mv
order by mv.created_at desc;

-- 6. Role Permissions: Grant SELECT on views to anon and authenticated
grant select on public.dashboard_overview_kpis to anon, authenticated;

grant select on public.dashboard_material_breakdown to anon, authenticated;

grant select on public.dashboard_pickup_trends to anon, authenticated;

grant select on public.dashboard_district_aggregates to anon, authenticated;

grant select on public.dashboard_model_transparency to anon, authenticated;
