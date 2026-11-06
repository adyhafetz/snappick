-- Migration 20261105000100: harden proof photos, cap open requests, require rating to confirm
--
-- 1. submit_collection: proof must be captured within 12 hours and the uploaded
--    object must exist in the proofs bucket (>= 1 KB), instead of trusting the path.
-- 2. proofs bucket: JPEG only, 10 MB max.
-- 3. create_pickup_request: at most 5 simultaneously open requests per requester.
-- 4. confirm_pickup: no longer callable by users; rate_and_confirm_pickup is the
--    only user-facing confirmation, so a rating cannot be skipped through the API.

CREATE OR REPLACE FUNCTION public.create_pickup_request(p_lat double precision, p_lng double precision, p_unit_number text, p_street text, p_landmark text, p_access_instructions text, p_pickup_note text, p_pickup_window_start timestamp with time zone, p_pickup_window_end timestamp with time zone, p_items jsonb, p_restricted_item_confirmation boolean)
 RETURNS TABLE(id uuid, status pickup_request_status, district_name text, rule_set_id uuid, rule_set_version integer, material_summary jsonb, pickup_window_start timestamp with time zone, pickup_window_end timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
  -- Anti-spam: cap simultaneously open requests per requester.
  if (select count(*) from public.pickup_requests_public open_r
      where open_r.requester_id = requester
        and open_r.status in ('pending', 'accepted', 'in_progress')) >= 5 then
    raise exception using errcode = 'P0001', message = 'OPEN_REQUEST_LIMIT';
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
$function$;

CREATE OR REPLACE FUNCTION public.submit_collection(request_id uuid, p_items jsonb DEFAULT NULL::jsonb, p_non_collection_reason text DEFAULT NULL::text, p_proof_path text DEFAULT NULL::text, p_captured_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(id uuid, status pickup_request_status, confirmation_deadline timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  target public.pickup_requests_public%rowtype;
  item jsonb;
  row public.pickup_waste_items%rowtype;
  qty integer;
  condition_value public.condition_state;
  total_collected integer := 0;
  deadline timestamptz;
begin
  if actor is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  select r.* into target
  from public.pickup_requests_public r
  where r.id = submit_collection.request_id for update;

  if not found or target.collector_id <> actor or target.status <> 'in_progress' then
    raise exception using errcode = 'P0001', message = 'REQUEST_NOT_SUBMITTABLE';
  end if;

  if p_proof_path is null or length(p_proof_path) > 500 or p_proof_path !~ ('^' || actor::text || '/' || request_id::text || '/[A-Za-z0-9._-]+[.]jpg$') then
    raise exception using errcode = '22023', message = 'PROOF_REQUIRED';
  end if;

  -- Proof must have been taken recently and the uploaded file must really exist.
  if p_captured_at is null
     or p_captured_at < now() - interval '12 hours'
     or p_captured_at > now() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'PROOF_TIME_INVALID';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'proofs'
      and o.name = p_proof_path
      and coalesce((o.metadata->>'size')::bigint, 0) >= 1024
  ) then
    raise exception using errcode = '22023', message = 'PROOF_FILE_INVALID';
  end if;

  -- 1. Case: Unable to collect (Non-collection reported with reason)
  if p_non_collection_reason is not null and btrim(p_non_collection_reason) <> '' then
    if coalesce(nullif(btrim(p_non_collection_reason), ''), '') not in ('contaminated', 'missing', 'unsafe', 'access_issue', 'other') then
      raise exception using errcode = '22023', message = 'NON_COLLECTION_REASON_REQUIRED';
    end if;

    update public.pickup_waste_items w
    set collector_quantity = 0,
        collector_condition = preparation_state,
        not_collected_reason = btrim(p_non_collection_reason),
        collector_verified_at = now(),
        collector_verified_by = actor
    where w.request_id = target.id;

    update public.pickup_requests_public r
    set status = 'not_collected',
        non_collection_reason = btrim(p_non_collection_reason),
        submitted_at = now(),
        completed_at = now()
    where r.id = target.id;

    insert into public.pickup_proofs (request_id, uploaded_by, storage_path, captured_at, is_non_collection_evidence)
    values (target.id, actor, p_proof_path, coalesce(p_captured_at, now()), true);

    return query select target.id, 'not_collected'::public.pickup_request_status, null::timestamptz;
    return;
  end if;

  -- 2. Case: Streamlined collection (Default happy path - all requested items collected)
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    update public.pickup_waste_items w
    set collector_quantity = requester_quantity,
        collector_condition = preparation_state,
        not_collected_reason = null,
        collector_verified_at = now(),
        collector_verified_by = actor
    where w.request_id = target.id
      and w.accepted = true
      and w.eligibility = 'eligible';

    deadline := now() + interval '48 hours';
    update public.pickup_requests_public r
    set status = 'awaiting_confirmation',
        submitted_at = now(),
        confirmation_deadline = deadline,
        non_collection_reason = null
    where r.id = target.id;

    insert into public.pickup_proofs (request_id, uploaded_by, storage_path, captured_at, is_non_collection_evidence)
    values (target.id, actor, p_proof_path, coalesce(p_captured_at, now()), false);

    return query select target.id, 'awaiting_confirmation'::public.pickup_request_status, deadline;
    return;
  end if;

  -- 3. Case: Legacy / manual item array passed
  for item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(item->'id') is distinct from 'string' or jsonb_typeof(item->'quantity') is distinct from 'number'
       or jsonb_typeof(item->'condition') is distinct from 'string' then
      raise exception using errcode = '22023', message = 'INVALID_CHECKLIST_ITEM';
    end if;

    select w.* into row
    from public.pickup_waste_items w
    where w.id = (item->>'id')::uuid and w.request_id = submit_collection.request_id for update;

    if not found then
      raise exception using errcode = '22023', message = 'INVALID_CHECKLIST_ITEM';
    end if;

    if not row.accepted or row.eligibility <> 'eligible' then
      raise exception using errcode = '22023', message = 'INELIGIBLE_CHECKLIST_ITEM';
    end if;

    qty := (item->>'quantity')::integer;
    if qty < 0 or qty > row.requester_quantity then
      raise exception using errcode = '22023', message = 'INVALID_QUANTITY';
    end if;

    begin
      condition_value := (item->>'condition')::public.condition_state;
    exception when others then
      raise exception using errcode = '22023', message = 'INVALID_CONDITION';
    end;

    if qty < row.requester_quantity and coalesce(nullif(btrim(item->>'reason'), ''), '') not in ('contaminated', 'missing', 'unsafe', 'access_issue', 'other') then
      raise exception using errcode = '22023', message = 'NON_COLLECTION_REASON_REQUIRED';
    end if;

    update public.pickup_waste_items w
    set collector_quantity = qty,
        collector_condition = condition_value,
        not_collected_reason = nullif(btrim(item->>'reason'), ''),
        collector_verified_at = now(),
        collector_verified_by = actor
    where w.id = row.id;

    total_collected := total_collected + qty;
  end loop;

  if total_collected = 0 then
    update public.pickup_requests_public r
    set status = 'not_collected',
        non_collection_reason = 'missing',
        submitted_at = now(),
        completed_at = now()
    where r.id = target.id;

    insert into public.pickup_proofs (request_id, uploaded_by, storage_path, captured_at, is_non_collection_evidence)
    values (target.id, actor, p_proof_path, coalesce(p_captured_at, now()), true);

    return query select target.id, 'not_collected'::public.pickup_request_status, null::timestamptz;
    return;
  end if;

  deadline := now() + interval '48 hours';
  update public.pickup_requests_public r
  set status = 'awaiting_confirmation',
      submitted_at = now(),
      confirmation_deadline = deadline,
      non_collection_reason = null
  where r.id = target.id;

  insert into public.pickup_proofs (request_id, uploaded_by, storage_path, captured_at, is_non_collection_evidence)
  values (target.id, actor, p_proof_path, coalesce(p_captured_at, now()), false);

  return query select target.id, 'awaiting_confirmation'::public.pickup_request_status, deadline;
end;
$function$;

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg']
where id = 'proofs';

revoke execute on function public.confirm_pickup(uuid) from authenticated;
