-- Phase 7: requester-only private details and atomic, server-validated creation.
alter table public.pickup_requests_public
  add column if not exists rule_set_version integer;

alter table public.pickup_request_private_details
  add column if not exists pickup_note text;

update public.pickup_request_private_details private_details
set pickup_note = public_request.pickup_note
from public.pickup_requests_public public_request
where public_request.id = private_details.request_id
  and public_request.pickup_note is not null
  and private_details.pickup_note is null;

do $$
begin
  if exists (
    select 1
    from public.pickup_requests_public public_request
    where public_request.pickup_note is not null
      and not exists (
        select 1 from public.pickup_request_private_details private_details
        where private_details.request_id = public_request.id
      )
  ) then
    raise exception 'Cannot move legacy pickup notes: a request has no private details row';
  end if;
end;
$$;

alter table public.pickup_requests_public drop column if exists pickup_note;

update public.pickup_requests_public public_request
set rule_set_version = rule_set.version
from public.pbt_rule_sets rule_set
where rule_set.id = public_request.rule_set_id
  and public_request.rule_set_version is null;

alter table public.pickup_waste_items
  add column if not exists review_item_id text,
  add column if not exists source text not null default 'detector',
  add column if not exists eligibility text not null default 'eligible';

alter table public.pickup_waste_items
  add constraint pickup_waste_items_source_check check (source in ('detector', 'user_added')),
  add constraint pickup_waste_items_eligibility_check check (eligibility in ('eligible', 'needs_confirmation', 'not_eligible', 'restricted'));

create or replace function public.resolve_pickup_area(lat double precision, lng double precision)
returns table (
  district_id uuid,
  district_name text,
  rule_set_id uuid,
  rule_set_name text,
  rule_set_version integer,
  rules jsonb
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  exact_point extensions.geometry(Point, 4326);
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if lat is null or lng is null or lat not between -90 and 90 or lng not between -180 and 180 then
    raise exception using errcode = '22023', message = 'INVALID_COORDINATES';
  end if;
  if not exists (select 1 from public.perak_districts where not is_placeholder) then
    raise exception using errcode = 'P0001', message = 'SERVICE_AREA_UNAVAILABLE';
  end if;

  exact_point := extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326);
  return query
  select d.id,
         d.name,
         rs.id,
         rs.name,
         rs.version,
         rs.rules
  from public.perak_districts d
  cross join lateral (
    select candidate.id, candidate.name, candidate.version, candidate.rules
    from public.pbt_rule_sets candidate
    where candidate.is_active
      and candidate.effective_from <= now()
      and (candidate.effective_to is null or candidate.effective_to > now())
      and candidate.name in (d.slug, 'perak_general')
    order by (candidate.name = d.slug) desc, candidate.version desc
    limit 1
  ) rs
  where not d.is_placeholder
    and extensions.st_covers(d.boundary, exact_point)
  order by extensions.st_area(d.boundary::extensions.geography), d.slug
  limit 1;

  if not found and exists (
    select 1 from public.perak_districts d
    where not d.is_placeholder and extensions.st_covers(d.boundary, exact_point)
  ) then
    raise exception using errcode = 'P0001', message = 'RULE_SET_UNAVAILABLE';
  end if;
end;
$$;

revoke all on function public.resolve_pickup_area(double precision, double precision) from public, anon;
grant execute on function public.resolve_pickup_area(double precision, double precision) to authenticated, service_role;

create or replace function public.create_pickup_request(
  p_lat double precision,
  p_lng double precision,
  p_unit_number text,
  p_street text,
  p_landmark text,
  p_access_instructions text,
  p_pickup_note text,
  p_pickup_window_start timestamptz,
  p_pickup_window_end timestamptz,
  p_items jsonb,
  p_restricted_item_confirmation boolean
)
returns table (
  id uuid,
  status public.pickup_request_status,
  district_name text,
  rule_set_id uuid,
  rule_set_version integer,
  material_summary jsonb,
  pickup_window_start timestamptz,
  pickup_window_end timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  requester uuid := auth.uid();
  exact_point extensions.geometry(Point, 4326);
  public_point extensions.geometry(Point, 4326);
  area record;
  item jsonb;
  class_name text;
  item_source text;
  item_condition public.condition_state;
  item_quantity integer;
  eligibility_value text;
  rule_entry jsonb;
  item_ids text[] := array[]::text[];
  has_eligible boolean := false;
  request_id uuid;
  safe_summary jsonb;
  created timestamptz;
begin
  if requester is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception using errcode = '22023', message = 'INVALID_COORDINATES';
  end if;
  if not coalesce(p_restricted_item_confirmation, false) then
    raise exception using errcode = '22023', message = 'RESTRICTED_ITEM_CONFIRMATION_REQUIRED';
  end if;
  if length(btrim(coalesce(p_unit_number, ''))) not between 1 and 40
     or length(btrim(coalesce(p_street, ''))) not between 1 and 160
     or length(coalesce(p_landmark, '')) > 160
     or length(coalesce(p_access_instructions, '')) > 500
     or length(coalesce(p_pickup_note, '')) > 500 then
    raise exception using errcode = '22023', message = 'INVALID_PRIVATE_DETAILS';
  end if;
  if p_pickup_window_start is null or p_pickup_window_end is null
     or p_pickup_window_start < now()
     or p_pickup_window_end <= p_pickup_window_start
     or p_pickup_window_end > now() + interval '31 days' then
    raise exception using errcode = '22023', message = 'INVALID_PICKUP_WINDOW';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception using errcode = '22023', message = 'INVALID_PICKUP_ITEMS';
  end if;
  if not exists (select 1 from public.perak_districts where not is_placeholder) then
    raise exception using errcode = 'P0001', message = 'SERVICE_AREA_UNAVAILABLE';
  end if;

  exact_point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326);
  select resolved.* into area
  from public.resolve_pickup_area(p_lat, p_lng) resolved;
  if not found then
    raise exception using errcode = 'P0001', message = 'OUTSIDE_SUPPORTED_SERVICE_AREA';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(item) is distinct from 'object'
       or jsonb_typeof(item->'id') is distinct from 'string'
       or jsonb_typeof(item->'class') is distinct from 'string'
       or jsonb_typeof(item->'source') is distinct from 'string'
       or jsonb_typeof(item->'condition') is distinct from 'string'
       or jsonb_typeof(item->'quantity') is distinct from 'number'
       or jsonb_typeof(item->'eligibility') is distinct from 'string' then
      raise exception using errcode = '22023', message = 'INVALID_PICKUP_ITEM';
    end if;
    if length(item->>'id') not between 1 and 100 or item->>'id' = any(item_ids) then
      raise exception using errcode = '22023', message = 'INVALID_PICKUP_ITEM';
    end if;
    item_ids := array_append(item_ids, item->>'id');
    class_name := item->>'class';
    item_source := item->>'source';
    if item->>'quantity' !~ '^[0-9]+$' then
      raise exception using errcode = '22023', message = 'INVALID_PICKUP_ITEM';
    end if;
    item_quantity := (item->>'quantity')::integer;
    if item_source not in ('detector', 'user_added')
       or (item_source = 'detector' and item_quantity <> 1)
       or item_quantity not between 1 and 1000
       or class_name not in ('metal', 'trash', 'glass', 'paper', 'cardboard', 'plastic', 'biological')
       or item->>'eligibility' not in ('eligible', 'needs_confirmation', 'not_eligible', 'restricted')
       or length(class_name) not between 1 and 64 then
      raise exception using errcode = '22023', message = 'INVALID_PICKUP_ITEM';
    end if;
    begin
      item_condition := (item->>'condition')::public.condition_state;
    exception when others then
      raise exception using errcode = '22023', message = 'INVALID_PICKUP_ITEM';
    end;
    rule_entry := area.rules->'classes'->class_name;
    if rule_entry is null or jsonb_typeof(rule_entry->'conditionRules'->item_condition::text) <> 'object' then
      raise exception using errcode = '22023', message = 'UNSUPPORTED_PICKUP_ITEM';
    end if;
    eligibility_value := area.rules->'classes'->class_name->'conditionRules'->item_condition::text->>'eligibility';
    if eligibility_value not in ('eligible', 'needs_confirmation', 'not_eligible', 'restricted') then
      raise exception using errcode = 'P0001', message = 'RULE_SET_UNAVAILABLE';
    end if;
    has_eligible := has_eligible or eligibility_value = 'eligible';
  end loop;
  if not has_eligible then
    raise exception using errcode = '22023', message = 'NO_ELIGIBLE_ITEMS';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('class', grouped.app_class, 'quantity', grouped.quantity) order by grouped.app_class), '[]'::jsonb)
  into safe_summary
  from (
    select item_value->>'class' as app_class,
           sum((item_value->>'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) item_value
    where area.rules->'classes'->(item_value->>'class')->'conditionRules'->(item_value->>'condition')->>'eligibility' = 'eligible'
    group by item_value->>'class'
  ) grouped;

  public_point := extensions.st_snaptogrid(exact_point, 0.01);
  insert into public.pickup_requests_public (
    requester_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location
  ) values (
    requester, 'pending', area.district_id, area.rule_set_id, area.rule_set_version,
    safe_summary, p_pickup_window_start, p_pickup_window_end, public_point
  ) returning pickup_requests_public.id, pickup_requests_public.created_at into request_id, created;

  insert into public.pickup_request_private_details (
    request_id, exact_location, unit_number, street, landmark, access_instructions, pickup_note
  ) values (
    request_id, exact_point, btrim(p_unit_number), btrim(p_street), nullif(btrim(p_landmark), ''),
    nullif(btrim(p_access_instructions), ''), nullif(btrim(p_pickup_note), '')
  );

  for item in select value from jsonb_array_elements(p_items)
  loop
    eligibility_value := area.rules->'classes'->(item->>'class')->'conditionRules'->(item->>'condition')->>'eligibility';
    insert into public.pickup_waste_items (
      request_id, app_class, requester_quantity, accepted, preparation_state,
      review_item_id, source, eligibility
    ) values (
      request_id, item->>'class', (item->>'quantity')::integer,
      eligibility_value = 'eligible', (item->>'condition')::public.condition_state,
      item->>'id', item->>'source', eligibility_value
    );
  end loop;

  return query select request_id, 'pending'::public.pickup_request_status, area.district_name,
                      area.rule_set_id, area.rule_set_version, safe_summary,
                      p_pickup_window_start, p_pickup_window_end, created;
end;
$$;

revoke all on function public.create_pickup_request(double precision, double precision, text, text, text, text, text, timestamptz, timestamptz, jsonb, boolean) from public, anon;
grant execute on function public.create_pickup_request(double precision, double precision, text, text, text, text, text, timestamptz, timestamptz, jsonb, boolean) to authenticated;

create or replace function public.cancel_pickup_request(request_id uuid)
returns table (id uuid, status public.pickup_request_status, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;
  return query
    update public.pickup_requests_public r
    set status = 'cancelled'
    where r.id = request_id
      and r.requester_id = auth.uid()
      and r.status = 'pending'
    returning r.id, r.status, r.updated_at;
  if not found then
    raise exception using errcode = 'P0001', message = 'REQUEST_NOT_CANCELLABLE';
  end if;
end;
$$;

revoke all on function public.cancel_pickup_request(uuid) from public, anon;
grant execute on function public.cancel_pickup_request(uuid) to authenticated;

-- Request creation and cancellation are RPC-only; requester reads remain scoped by RLS.
drop policy if exists pickup_public_insert_own on public.pickup_requests_public;
drop policy if exists pickup_public_update_participant on public.pickup_requests_public;
drop policy if exists pickup_public_delete_requester on public.pickup_requests_public;
drop policy if exists pickup_private_requester_insert on public.pickup_request_private_details;
drop policy if exists pickup_private_requester_update on public.pickup_request_private_details;
drop policy if exists waste_participant on public.pickup_waste_items;

create policy pickup_public_read_requester on public.pickup_requests_public
  for select to authenticated using (requester_id = auth.uid() or public.is_admin());
drop policy if exists pickup_public_read_authenticated on public.pickup_requests_public;

create policy pickup_private_read_requester on public.pickup_request_private_details
  for select to authenticated using (
    exists (select 1 from public.pickup_requests_public r where r.id = request_id and r.requester_id = auth.uid())
  );
drop policy if exists pickup_private_participant on public.pickup_request_private_details;

create policy pickup_waste_read_requester on public.pickup_waste_items
  for select to authenticated using (
    exists (select 1 from public.pickup_requests_public r where r.id = request_id and (r.requester_id = auth.uid() or public.is_admin()))
  );

revoke select, insert, update, delete, truncate, references, trigger on public.pickup_requests_public from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.pickup_request_private_details from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.pickup_waste_items from anon, authenticated;
grant select (id, requester_id, status, district_id, rule_set_id, rule_set_version, material_summary,
  pickup_window_start, pickup_window_end, approximate_location, claimed_at, created_at, updated_at)
  on public.pickup_requests_public to authenticated;
grant select on public.pickup_request_private_details, public.pickup_waste_items to authenticated;

create or replace view public.my_pickup_requests
with (security_barrier = true)
as
  select r.id, r.status, r.district_id, d.name as district_name, r.rule_set_id,
         r.rule_set_version, r.material_summary, r.pickup_window_start,
         r.pickup_window_end, r.approximate_location, r.created_at, r.updated_at
  from public.pickup_requests_public r
  left join public.perak_districts d on d.id = r.district_id
  where r.requester_id = auth.uid();

revoke all on public.my_pickup_requests from public, anon;
grant select on public.my_pickup_requests to authenticated;
