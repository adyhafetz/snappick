-- Removes the demo rows made by seed_demo_account.sql (ids starting with de000000). The open pickups created by
-- supabase/tests/seed-demo.mjs are cancelled by that script's own "clean" mode.
begin;
delete from public.pickup_ratings where request_id::text like 'de000000-%';
delete from public.pickup_requests_public where id::text like 'de000000-%';
delete from public.scans where id::text like 'de000000-%';
commit;
