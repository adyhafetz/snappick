-- Phase 6: replace the former thirteen-class seed with versioned plain-text rules.
insert into public.pbt_rule_sets (name, version, rules, effective_from, source, reviewed_by, reviewed_at, is_active)
values (
  'perak_general', 2,
  '{"label":"General Perak guidance","classes":{
    "metal":{"material":"recyclable","conditionRules":{"clean_dry":{"eligibility":"needs_confirmation","reason":"Confirm local metal acceptance and remove unsafe parts."},"contaminated_wet":{"eligibility":"not_eligible","reason":"Only clean and dry items should be offered."},"broken_unsafe":{"eligibility":"restricted","reason":"Do not offer sharp or unsafe metal."},"unknown":{"eligibility":"needs_confirmation","reason":"Confirm the item is safe and accepted locally."}}},
    "trash":{"material":"not_recyclable","conditionRules":{"clean_dry":{"eligibility":"not_eligible","reason":"General waste is not accepted for recycling pickup."},"contaminated_wet":{"eligibility":"not_eligible","reason":"General waste is not accepted for recycling pickup."},"broken_unsafe":{"eligibility":"not_eligible","reason":"General waste is not accepted for recycling pickup."},"unknown":{"eligibility":"not_eligible","reason":"General waste is not accepted for recycling pickup."}}},
    "glass":{"material":"recyclable","conditionRules":{"clean_dry":{"eligibility":"needs_confirmation","reason":"Confirm local glass acceptance; only offer intact glass."},"contaminated_wet":{"eligibility":"not_eligible","reason":"Only clean and dry items should be offered."},"broken_unsafe":{"eligibility":"restricted","reason":"Broken glass is unsafe; do not place it in community pickup."},"unknown":{"eligibility":"needs_confirmation","reason":"Confirm the glass is intact and accepted locally."}}},
    "paper":{"material":"recyclable","conditionRules":{"clean_dry":{"eligibility":"eligible","reason":"Clean, dry paper may be offered under general Perak guidance."},"contaminated_wet":{"eligibility":"not_eligible","reason":"Wet or contaminated paper is not eligible."},"broken_unsafe":{"eligibility":"not_eligible","reason":"Separate any unsafe contamination before pickup."},"unknown":{"eligibility":"needs_confirmation","reason":"Check that the paper is clean and dry."}}},
    "cardboard":{"material":"recyclable","conditionRules":{"clean_dry":{"eligibility":"eligible","reason":"Clean, dry cardboard may be offered under general Perak guidance."},"contaminated_wet":{"eligibility":"not_eligible","reason":"Wet or contaminated cardboard is not eligible."},"broken_unsafe":{"eligibility":"not_eligible","reason":"Separate any unsafe contamination before pickup."},"unknown":{"eligibility":"needs_confirmation","reason":"Check that the cardboard is clean and dry."}}},
    "plastic":{"material":"recyclable","conditionRules":{"clean_dry":{"eligibility":"needs_confirmation","reason":"Plastic acceptance varies by item and local collection rules."},"contaminated_wet":{"eligibility":"not_eligible","reason":"Only clean and dry items should be offered."},"broken_unsafe":{"eligibility":"restricted","reason":"Do not offer sharp or unsafe plastic."},"unknown":{"eligibility":"needs_confirmation","reason":"Confirm item type, condition, and local acceptance."}}},
    "biological":{"material":"not_recyclable","conditionRules":{"clean_dry":{"eligibility":"not_eligible","reason":"Biological waste is not accepted for this recycling pickup."},"contaminated_wet":{"eligibility":"not_eligible","reason":"Biological waste is not accepted for this recycling pickup."},"broken_unsafe":{"eligibility":"not_eligible","reason":"Biological waste is not accepted for this recycling pickup."},"unknown":{"eligibility":"not_eligible","reason":"Biological waste is not accepted for this recycling pickup."}}}
  },"manualSafety":{"batteries":"restricted","bulbs":"restricted","e_waste":"restricted","chemicals":"restricted","sharp_objects":"restricted","other_hazards":"restricted"}}'::jsonb,
  now(), 'Phase 6 provisional general guidance; verify with local PBT sources', 'unreviewed', null, true
)
on conflict (name, version) do update set rules = excluded.rules, is_active = true;

update public.pbt_rule_sets set is_active = false where name = 'perak_general' and version <> 2;

-- Resolution never returns a district with placeholder geometry or an unconfigured local rule set.
create or replace function public.resolve_rule_set(lat double precision, lng double precision)
returns table(id uuid, name text, version integer, rules jsonb)
language sql stable security definer set search_path = public, extensions
as $$
  select rs.id, rs.name, rs.version, rs.rules
  from public.perak_districts d
  join public.pbt_rule_sets rs on rs.name = d.slug and rs.is_active
  where not d.is_placeholder
    and extensions.st_covers(d.boundary, extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326))
    and lat between -90 and 90 and lng between -180 and 180
  order by rs.version desc limit 1
$$;
revoke all on function public.resolve_rule_set(double precision, double precision) from public;
grant execute on function public.resolve_rule_set(double precision, double precision) to authenticated, service_role;

-- Serialize global daily reservations so concurrent Edge invocations cannot exceed the cap.
create or replace function public.reserve_guidance_llm_budget(daily_limit integer, model_name text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare reserved_count integer;
begin
  if daily_limit < 1 or daily_limit > 10000 then return false; end if;
  perform pg_advisory_xact_lock(610614);
  select count(*)::integer into reserved_count
  from public.llm_usage where created_at >= date_trunc('day', now());
  if reserved_count >= daily_limit then return false; end if;
  insert into public.llm_usage (user_id, cache_key, model)
  values (null, null, model_name);
  return true;
end;
$$;
revoke all on function public.reserve_guidance_llm_budget(integer, text) from public, anon, authenticated;
grant execute on function public.reserve_guidance_llm_budget(integer, text) to service_role;

-- Only service_role (the authenticated Edge Function) may write the cache.
drop policy if exists instruction_cache_admin_write on public.instruction_cache;
drop policy if exists instruction_cache_read_authenticated on public.instruction_cache;
revoke all on public.instruction_cache from anon, authenticated;
grant select, insert, update on public.instruction_cache to service_role;
