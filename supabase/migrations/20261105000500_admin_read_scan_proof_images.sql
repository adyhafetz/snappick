-- Migration 20261105000500: let admins view scan and proof photos
--
-- The scans and proofs buckets only allowed the owner (folder = their user id) to read objects,
-- so the admin dashboard could not create signed URLs: the Dataset review card showed no photo
-- and the dispute dialog said "No proof photo" even when one existed.

create policy scans_proofs_admin_read
  on storage.objects
  for select
  to authenticated
  using (bucket_id in ('scans', 'proofs') and public.is_admin());
