-- Community demo data: realistic, anonymous activity so the public dashboard has something to show.
--
-- Creates about 120 fake residents and 16 fake collectors (email ...@demo.snappick.test, no password, cannot sign in),
-- then about 6 months of scans, detections, pickups, items, ratings and a few disputes across the 13 Perak districts,
-- counted back from today, so "30 days" and "90 days" always have data.
-- Patterns are deliberate so charts look meaningful: activity grows month by month, Kinta and Manjung lead,
-- remote districts (Hulu Perak, Selama, Bagan Datuk, Muallim) have few collectors and many unclaimed requests.
--
-- Safe by design:
--   * Re-running replaces the previous demo data (same fixed random seed, so the same shape every time).
--   * Only final statuses are created (completed, not_collected, cancelled, expired), so nothing appears
--     on the collectors' live map in the app.
--   * Scans have no image_path, so they never enter the model training pool.
--   * No addresses or exact locations are created (only grid-snapped points, like the real app).
-- Run:     npx supabase db query --linked -f scripts/seed/community.sql   (or paste into the SQL editor)
-- Remove:  scripts/clean_all_data.sql (everything), or delete from auth.users where email like '%@demo.snappick.test'.
-- The dashboard figures are refreshed at the end.

begin;
select setseed(0.2026);

-- 0. Remove any previous demo data (cascades to profiles, scans, pickups, items, ratings, disputes).
delete from auth.users where email like '%@demo.snappick.test';

-- District demand model: relative weight, share of requests nobody claims, and how slow claims are.
create temp table pw (name text, w int, unclaimed numeric, slow numeric, lo numeric, hi numeric) on commit drop;
insert into pw (name, w, unclaimed, slow) values
  ('Kinta', 22, 0.08, 1.0), ('Manjung', 14, 0.12, 1.1), ('Larut Dan Matang', 11, 0.14, 1.2),
  ('Kampar', 9, 0.15, 1.2), ('Kuala Kangsar', 7, 0.22, 1.5), ('Batang Padang', 6, 0.25, 1.5),
  ('Hilir Perak', 5, 0.28, 1.7), ('Kerian', 5, 0.30, 1.7), ('Perak Tengah', 4, 0.28, 1.6),
  ('Bagan Datuk', 3, 0.38, 2.0), ('Selama', 2, 0.45, 2.2), ('Hulu Perak', 2, 0.50, 2.5),
  ('Muallim', 2, 0.42, 2.0);
update pw set lo = s.lo, hi = s.hi
from (select name, sum(w) over (order by name) - w as lo, sum(w) over (order by name) as hi from pw) s
where pw.name = s.name;

-- Material model (recyclable classes first so the first item of a request is always recyclable).
create temp table cw (name text, lo numeric, hi numeric) on commit drop;
insert into cw values ('plastic', 0, 30), ('paper', 30, 50), ('cardboard', 50, 68), ('metal', 68, 80),
                      ('glass', 80, 92), ('trash', 92, 96), ('biological', 96, 100);

create temp table params on commit drop as
select date_trunc('month', now()) - interval '5 months' as start_ts,
       (select id from public.pbt_rule_sets where is_active order by created_at limit 1) as rule_id,
       (select version from public.pbt_rule_sets where is_active order by created_at limit 1) as rule_ver;

-- 1. Users ---------------------------------------------------------------------------------------------
create temp table demo_users on commit drop as
select ('5eed0001-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid as id, i, 'resident'::text as kind,
       format('demo_resident_%s@demo.snappick.test', lpad(i::text, 3, '0')) as email,
       format('Demo Resident %s', lpad(i::text, 3, '0')) as name,
       date_trunc('day', p.start_ts + power(rnd.u, 0.7) * (now() - p.start_ts - interval '10 days')) as joined_at,
       d.id as district_id, d.name as district_name
from generate_series(1, 120) as i
cross join params p
cross join lateral (select random() + 0 * i as u, random() * 92 + 0 * i as r) rnd
join pw on rnd.r >= pw.lo and rnd.r < pw.hi
join public.perak_districts d on d.name = pw.name;

create temp table demo_collectors on commit drop as
select ('5eed0002-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid as id, i, 'collector'::text as kind,
       format('demo_collector_%s@demo.snappick.test', lpad(i::text, 2, '0')) as email,
       format('Demo Collector %s', lpad(i::text, 2, '0')) as name,
       p.start_ts + random() * interval '3 days' as joined_at,
       d.id as district_id, d.name as district_name
from (values (1,'Kinta'),(2,'Kinta'),(3,'Kinta'),(4,'Kinta'),(5,'Manjung'),(6,'Manjung'),(7,'Manjung'),
             (8,'Larut Dan Matang'),(9,'Larut Dan Matang'),(10,'Kampar'),(11,'Kampar'),(12,'Kuala Kangsar'),
             (13,'Batang Padang'),(14,'Hilir Perak'),(15,'Kerian'),(16,'Perak Tengah')) as v(i, dn)
cross join params p
join public.perak_districts d on d.name = v.dn;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, reauthentication_token, email_change_token_current
)
select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email, '', joined_at,
       '{"provider":"email","providers":["email"]}', jsonb_build_object('name', name, 'demo', true), joined_at, joined_at,
       '', '', '', '', '', '', '', ''
from (select * from demo_users union all select * from demo_collectors) u;

-- The sign-up trigger creates the profiles; fill them in.
update public.profiles p
set display_name = u.name, created_at = u.joined_at,
    image_storage_consent = true, image_storage_consent_at = u.joined_at,
    community_pickup_safety_acknowledged = true, community_pickup_safety_acknowledged_at = u.joined_at,
    training_opt_in = true, training_opt_in_at = u.joined_at
from (select id, name, joined_at from demo_users union all select id, name, joined_at from demo_collectors) u
where p.id = u.id;

-- 2. Scans and detections ------------------------------------------------------------------------------
create temp table demo_scans on commit drop as
select gen_random_uuid() as id, u.id as user_id,
       u.joined_at + power(random(), 1.2) * (now() - interval '1 hour' - u.joined_at) as created_at
from demo_users u
cross join lateral generate_series(1, 2 + floor(power(random() + 0 * u.i, 1.4) * 14)::int) g(n);

insert into public.scans (id, user_id, model_version, rule_set_id, rule_set_version, image_storage_consent, training_opt_in,
                          image_width, image_height, preprocess_ms, inference_ms, retention_date, created_at)
select s.id, s.user_id, 'v0', p.rule_id, p.rule_ver, true, true, 1080, 1920,
       10 + floor(random() * 8)::int, 38 + floor(random() * 25)::int, s.created_at + interval '90 days', s.created_at
from demo_scans s cross join params p;

insert into public.detections (scan_id, model_label, app_class, score, box_x1, box_y1, box_x2, box_y2, source, condition, eligibility, quantity, created_at)
select s.id, c.name, c.name, round((0.35 + 0.64 * power(rnd.sc, 0.45))::numeric, 4),
       round(rnd.x::numeric, 4), round(rnd.y::numeric, 4),
       round(least(0.98, rnd.x + 0.2 + rnd.w * 0.3)::numeric, 4), round(least(0.98, rnd.y + 0.2 + rnd.w * 0.3)::numeric, 4),
       'detector',
       (case when rnd.cs < 0.70 then 'clean_dry' when rnd.cs < 0.90 then 'contaminated_wet' when rnd.cs < 0.95 then 'broken_unsafe' else 'unknown' end)::public.condition_state,
       case when c.name in ('trash', 'biological') then 'not_eligible'
            when rnd.cs < 0.70 then 'eligible' when rnd.cs >= 0.95 then 'needs_confirmation' else 'not_eligible' end,
       1, s.created_at
from demo_scans s
cross join generate_series(1, 3) as slot
cross join lateral (select random() + 0 * (slot + extract(epoch from s.created_at)) as pr, random() * 100 + 0 * (slot + extract(epoch from s.created_at)) as rc, random() + 0 * (slot + extract(epoch from s.created_at)) as sc, random() + 0 * (slot + extract(epoch from s.created_at)) as cs,
                           random() * 0.5 + 0 * (slot + extract(epoch from s.created_at)) as x, random() * 0.5 + 0 * (slot + extract(epoch from s.created_at)) as y, random() + 0 * (slot + extract(epoch from s.created_at)) as w) rnd
join cw c on (case when slot = 1 then rnd.rc * 0.92 else rnd.rc end) >= c.lo
         and (case when slot = 1 then rnd.rc * 0.92 else rnd.rc end) < c.hi
where slot = 1 or rnd.pr < (case slot when 2 then 0.5 else 0.2 end);

-- 3. Pickups ----------------------------------------------------------------------------------------------
-- 3a. One row per pickup request with its whole story decided up front.
create temp table demo_req on commit drop as
with base as (
  select gen_random_uuid() as id, u.id as requester_id, u.district_id, pw.unclaimed, pw.slow,
         u.joined_at + power(random(), 1.15) * ((now() - interval '3 days') - u.joined_at) as created_at,
         random() as r_claim, random() as r_kind, random() as r_out, random() as r_auto, random() as r_cancel,
         random() as r_h1, random() as r_h2, random() as r_h3
  from demo_users u
  join pw on pw.name = u.district_name
  cross join lateral generate_series(1, 1 + floor(power(random() + 0 * u.i, 1.5) * 8)::int) g(n)
)
select b.*,
       (case when b.r_claim < b.unclaimed then (case when b.r_cancel < 0.7 then 'expired' else 'cancelled' end)
             when b.r_out < 0.04 then 'not_collected'
             when b.r_out < 0.07 then (case when b.r_kind < 0.5 then 'completed' else 'not_collected' end)
             else 'completed' end) as status,
       (b.r_claim >= b.unclaimed) as claimed,
       (case when b.r_claim >= b.unclaimed and b.r_out >= 0.04 and b.r_out < 0.07 then (case when b.r_kind < 0.5 then 'rejected' else 'upheld' end) end) as dispute,
       (select c.id from demo_collectors c where c.district_id = b.district_id and b.id is not null order by random() limit 1) as same_district_collector,
       (select c.id from demo_collectors c where b.id is not null order by random() limit 1) as any_collector
from base b;

alter table demo_req add column collector_id uuid, add column claimed_at timestamptz, add column submitted_at timestamptz,
                      add column completed_at timestamptz, add column reason text;
update demo_req set collector_id = coalesce(same_district_collector, any_collector) where claimed;
update demo_req set claimed_at = least(now() - interval '1 minute', created_at + make_interval(secs => least(72, (2 + (-ln(1 - r_h1)) * 9) * slow) * 3600)) where claimed;
update demo_req set submitted_at = least(now() - interval '1 minute', claimed_at + make_interval(secs => (6 + r_h2 * 40) * 3600)) where claimed;
update demo_req set completed_at = least(now() - interval '1 minute', submitted_at + make_interval(secs => (case when r_auto < 0.25 then 48 else 2 + r_h3 * 28 end) * 3600))
  where claimed and (status = 'completed' or dispute = 'rejected');
update demo_req set completed_at = submitted_at where claimed and status = 'not_collected' and dispute is null;
update demo_req set reason = (array['contaminated','missing','unsafe','access_issue','other'])[1 + floor(random() * 5)::int] where status = 'not_collected' and dispute is null;
update demo_req set completed_at = null where dispute = 'upheld';

-- 3b. Items per request (1 to 3 materials; the first is always a clean, recyclable one).
create temp table demo_items on commit drop as
select distinct on (r.id, c.name) r.id as request_id, c.name as app_class, slot,
       1 + floor(power(rnd.rq, 2) * 11)::int as qty,
       (case when slot = 1 or rnd.rs < 0.70 then 'clean_dry' when rnd.rs < 0.90 then 'contaminated_wet' when rnd.rs < 0.95 then 'broken_unsafe' else 'unknown' end)::public.condition_state as prep
from demo_req r
cross join generate_series(1, 3) as slot
cross join lateral (select random() + 0 * (slot + extract(epoch from r.created_at)) as pr, random() * 100 + 0 * (slot + extract(epoch from r.created_at)) as rc, random() + 0 * (slot + extract(epoch from r.created_at)) as rq, random() + 0 * (slot + extract(epoch from r.created_at)) as rs) rnd
join cw c on (case when slot = 1 then rnd.rc * 0.92 else rnd.rc end) >= c.lo
         and (case when slot = 1 then rnd.rc * 0.92 else rnd.rc end) < c.hi
where slot = 1 or rnd.pr < (case slot when 2 then 0.55 else 0.2 end)
order by r.id, c.name, slot;

alter table demo_items add column eligibility text;
update demo_items set eligibility = case when app_class in ('trash', 'biological') then 'not_eligible'
                                          when prep = 'clean_dry' then 'eligible' when prep = 'unknown' then 'needs_confirmation'
                                          else 'not_eligible' end;

-- 3c. Insert the requests (grid-snapped locations inside the district, like the real app).
insert into public.pickup_requests_public (
  id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version, material_summary,
  pickup_window_start, pickup_window_end, approximate_location, claimed_at, submitted_at, confirmation_deadline,
  completed_at, non_collection_reason, dispute_outcome, created_at, updated_at
)
select r.id, r.requester_id, r.collector_id, r.status::public.pickup_request_status, r.district_id, p.rule_id, p.rule_ver,
       coalesce((select jsonb_agg(jsonb_build_object('class', g.app_class, 'quantity', g.q) order by g.app_class)
                 from (select i.app_class, sum(i.qty)::int as q from demo_items i
                       where i.request_id = r.id and i.eligibility = 'eligible' group by i.app_class) g), '[]'::jsonb),
       date_trunc('day', r.created_at + interval '1 day') + interval '9 hours',
       date_trunc('day', r.created_at + interval '1 day') + interval '12 hours',
       coalesce(extensions.st_snaptogrid(extensions.st_geometryn(extensions.st_generatepoints(d.boundary, 1, (1000 + row_number() over ())::int), 1), 0.01),
                extensions.st_snaptogrid(extensions.st_pointonsurface(d.boundary), 0.01)),
       r.claimed_at, r.submitted_at, r.submitted_at + interval '48 hours', r.completed_at, r.reason,
       (case when r.dispute is not null then r.dispute end)::public.dispute_outcome,
       r.created_at, coalesce(r.completed_at, r.claimed_at, r.created_at)
from demo_req r
join public.perak_districts d on d.id = r.district_id
cross join params p;

insert into public.pickup_waste_items (request_id, app_class, requester_quantity, accepted, preparation_state, collector_quantity,
                                       not_collected_reason, source, eligibility, created_at)
select i.request_id, i.app_class, i.qty, i.eligibility = 'eligible', i.prep,
       case when r.status = 'completed' or r.dispute = 'rejected' then greatest(0, i.qty - (case when random() < 0.1 then 1 else 0 end))
            when r.claimed and r.status = 'not_collected' then 0 end,
       case when r.claimed and r.status = 'not_collected' then coalesce(r.reason, 'missing') end,
       'detector', i.eligibility, r.created_at
from demo_items i join demo_req r on r.id = i.request_id;

-- 3d. Ratings (collectors only, like the real app) and the few resolved disputes.
insert into public.pickup_ratings (request_id, requester_id, collector_id, rating, created_at)
select r.id, r.requester_id, r.collector_id,
       case when x.u < 0.62 then 5 when x.u < 0.88 then 4 when x.u < 0.96 then 3 when x.u < 0.99 then 2 else 1 end,
       r.completed_at
from demo_req r cross join lateral (select random() + 0 * extract(epoch from r.created_at) as u, random() + 0 * extract(epoch from r.created_at) as keep) x
where r.claimed and r.status = 'completed' and r.dispute is null and x.keep < 0.88;

insert into public.disputes (request_id, raised_by, reason, outcome, resolution_note, resolved_at, created_at)
select r.id, r.requester_id,
       (array['Items were not collected', 'Only part of the items were collected', 'The collector did not arrive'])[1 + floor(random() * 3)::int],
       r.dispute::public.dispute_outcome,
       case r.dispute when 'upheld' then 'Demo data: dispute upheld' else 'Demo data: dispute rejected' end,
       coalesce(r.completed_at, r.submitted_at) + interval '1 day', r.submitted_at + interval '3 hours'
from demo_req r where r.dispute is not null;

insert into public.pickup_ratings (request_id, requester_id, collector_id, rating, feedback_note, created_at)
select r.id, r.requester_id, r.collector_id, 1, 'Dispute upheld', r.submitted_at + interval '1 day'
from demo_req r where r.dispute = 'upheld';

select public.refresh_collector_rating(id) from demo_collectors;

commit;

-- Summary
select (select count(*) from auth.users where email like '%@demo.snappick.test') as demo_users,
       (select count(*) from public.scans s join auth.users u on u.id = s.user_id where u.email like '%@demo.snappick.test') as scans,
       (select count(*) from public.pickup_requests_public r join auth.users u on u.id = r.requester_id where u.email like '%@demo.snappick.test') as pickups,
       (select count(*) from public.pickup_requests_public r join auth.users u on u.id = r.requester_id where u.email like '%@demo.snappick.test' and r.status = 'completed') as completed,
       (select count(*) from public.pickup_ratings pr join auth.users u on u.id = pr.collector_id where u.email like '%@demo.snappick.test') as ratings;

select public.refresh_public_stats();
