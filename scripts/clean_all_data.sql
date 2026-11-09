-- Resets the linked Supabase project to "accounts only".
--
-- Keeps: the four real accounts (their auth users and profiles, with consents), the 14 districts, the PBT rule sets,
--        model v0, push tokens, storage buckets and the whole schema.
-- Deletes: every sample (pilot) user (email ending @pilot.snappick.test) and everything linked to them, all scans,
--        detections, pickups, items, ratings, disputes, proofs, label edits and training samples (also those of the
--        kept accounts), the AI caches and usage log, and the dashboard figures (regenerated empty at the end).
-- Does NOT delete files in storage (proof photos): remove them with the Storage API, see docs/DEVELOPMENT_GUIDE.md.
--
-- Run:  npx supabase db query --linked -f scripts/clean_all_data.sql
-- It runs in one transaction and stops without deleting anything if one of the four accounts is missing.

begin;

do $$
declare
  kept int;
begin
  select count(*) into kept from auth.users
  where email in ('adyhafetz@gmail.com', 'test_a@gmail.com', 'test_b@gmail.com', 'test_admin@gmail.com');
  if kept <> 4 then
    raise exception 'Expected the 4 kept accounts, found %. Nothing was deleted.', kept;
  end if;
end $$;

delete from public.pickup_ratings;
delete from public.disputes;
delete from public.pickup_proofs;
delete from public.pickup_waste_items;
delete from public.pickup_request_private_details;
delete from public.pickup_requests_public;
delete from public.feedback_samples;
delete from public.label_feedback;
delete from public.detections;
delete from public.scans;
delete from public.scan_upload_queue;
delete from public.reports;

-- Sample users; cascades to their profiles and anything left that points at them.
delete from auth.users where email like '%@pilot.snappick.test';

delete from public.instruction_cache;
delete from public.llm_usage;

-- Reset rating aggregates (the trigger that protects admin fields is paused for this one statement).
alter table public.profiles disable trigger profiles_prevent_privilege_escalation;
update public.profiles set rating_avg = 5.00, rating_count = 0;
alter table public.profiles enable trigger profiles_prevent_privilege_escalation;

commit;

select public.refresh_public_stats();

select u.email, coalesce(u.raw_app_meta_data ->> 'provider', '?') as provider, p.is_admin
from auth.users u left join public.profiles p on p.id = u.id order by u.email;
