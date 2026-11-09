-- The private 'scans' and 'proofs' buckets were missing on the remote project (only 'models' existed), so scan
-- photo uploads and collector proof photos failed with "Bucket not found". Recreate them as the first
-- migration defined them. The storage policies already exist. Safe to run when the buckets are present.
insert into storage.buckets (id, name, public)
values ('scans', 'scans', false), ('proofs', 'proofs', false)
on conflict (id) do nothing;

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg']
where id = 'proofs';
