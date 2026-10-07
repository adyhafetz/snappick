-- Phase 2: database and security foundation.
-- Class labels deliberately remain text: the model manifest is the source of truth.

create extension if not exists postgis with schema extensions;

create type public.condition_state as enum ('clean_dry', 'contaminated_wet', 'broken_unsafe', 'unknown');
create type public.pickup_request_status as enum ('pending', 'accepted', 'in_progress', 'awaiting_confirmation', 'completed', 'not_collected', 'cancelled', 'expired', 'disputed');
create type public.dispute_outcome as enum ('upheld', 'rejected', 'inconclusive');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  image_storage_consent boolean not null default false,
  image_storage_consent_at timestamptz,
  community_pickup_safety_acknowledged boolean not null default false,
  community_pickup_safety_acknowledged_at timestamptz,
  training_opt_in boolean not null default false,
  training_opt_in_at timestamptz,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pbt_rule_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version integer not null check (version > 0),
  rules jsonb not null default '{}'::jsonb,
  effective_from timestamptz not null,
  effective_to timestamptz,
  source text not null,
  reviewed_by text,
  reviewed_at timestamptz,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (name, version),
  check (effective_to is null or effective_to > effective_from)
);

create table public.perak_districts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  boundary extensions.geometry(MultiPolygon, 4326) not null,
  is_placeholder boolean not null default false,
  created_at timestamptz not null default now()
);
create index perak_districts_boundary_gix on public.perak_districts using gist (boundary);

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model_version text not null,
  rule_set_id uuid references public.pbt_rule_sets(id) on delete set null,
  rule_set_version integer,
  image_storage_consent boolean not null default false,
  training_opt_in boolean not null default false,
  image_path text,
  retention_until timestamptz not null,
  image_width integer not null check (image_width > 0),
  image_height integer not null check (image_height > 0),
  preprocess_ms integer check (preprocess_ms is null or preprocess_ms >= 0),
  inference_ms integer check (inference_ms is null or inference_ms >= 0),
  created_at timestamptz not null default now()
);
create index scans_user_created_idx on public.scans (user_id, created_at desc);

create table public.detections (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  model_label text not null,
  app_class text not null,
  score numeric(6,5) not null check (score >= 0 and score <= 1),
  second_best_label text,
  second_best_score numeric(6,5) check (second_best_score is null or (second_best_score >= 0 and second_best_score <= 1)),
  box_x1 numeric(8,7),
  box_y1 numeric(8,7),
  box_x2 numeric(8,7),
  box_y2 numeric(8,7),
  source text not null default 'detector' check (source in ('detector', 'user_added')),
  condition condition_state not null default 'unknown',
  eligibility text not null,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  check ((source = 'detector' and quantity = 1) or (source = 'user_added' and quantity >= 1)),
  check ((source = 'user_added' and box_x1 is null and box_y1 is null and box_x2 is null and box_y2 is null)
      or (source = 'detector' and box_x1 is not null and box_y1 is not null and box_x2 is not null and box_y2 is not null
          and box_x1 >= 0 and box_x1 <= 1 and box_y1 >= 0 and box_y1 <= 1 and box_x2 >= 0 and box_x2 <= 1 and box_y2 >= 0 and box_y2 <= 1
          and box_x2 >= box_x1 and box_y2 >= box_y1))
);
create index detections_scan_idx on public.detections (scan_id);

create table public.label_feedback (
  id uuid primary key default gen_random_uuid(),
  detection_id uuid references public.detections(id) on delete set null,
  scan_id uuid not null references public.scans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  original_model_label text,
  corrected_app_class text,
  original_condition condition_state,
  corrected_condition condition_state,
  feedback_type text not null check (feedback_type in ('confirm', 'change_label', 'remove', 'condition_change', 'collector_verification')),
  collector_verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.feedback_samples (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  label_tier text not null check (label_tier in ('A', 'B', 'C', 'D')),
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  collector_count_match boolean,
  training_opt_in boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.pickup_requests_public (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  collector_id uuid references auth.users(id) on delete set null,
  status pickup_request_status not null default 'pending',
  district_id uuid references public.perak_districts(id) on delete set null,
  rule_set_id uuid references public.pbt_rule_sets(id) on delete set null,
  material_summary jsonb not null default '[]'::jsonb,
  pickup_window_start timestamptz,
  pickup_window_end timestamptz,
  approximate_location extensions.geometry(Point, 4326) not null,
  pickup_note text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (pickup_window_end is null or pickup_window_start is null or pickup_window_end > pickup_window_start)
);
create index pickup_public_location_gix on public.pickup_requests_public using gist (approximate_location);
create index pickup_public_status_idx on public.pickup_requests_public (status, created_at desc);

create table public.pickup_request_private_details (
  request_id uuid primary key references public.pickup_requests_public(id) on delete cascade,
  exact_location extensions.geometry(Point, 4326) not null,
  unit_number text,
  street text not null,
  landmark text,
  access_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pickup_private_location_gix on public.pickup_request_private_details using gist (exact_location);

create table public.pickup_waste_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.pickup_requests_public(id) on delete cascade,
  app_class text not null,
  requester_quantity integer not null check (requester_quantity > 0),
  accepted boolean not null default true,
  preparation_state condition_state not null default 'unknown',
  collector_quantity integer check (collector_quantity is null or collector_quantity >= 0),
  collector_condition condition_state,
  not_collected_reason text,
  created_at timestamptz not null default now()
);

create table public.pickup_proofs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.pickup_requests_public(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  captured_at timestamptz,
  requester_confirmed_at timestamptz,
  auto_completed_at timestamptz,
  is_non_collection_evidence boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.pickup_requests_public(id) on delete cascade,
  raised_by uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  supporting_context text,
  outcome dispute_outcome,
  resolved_by uuid references auth.users(id) on delete set null,
  resolution_note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.instruction_cache (
  cache_key text primary key,
  advice jsonb not null,
  rule_set_id uuid references public.pbt_rule_sets(id) on delete set null,
  rule_set_version integer,
  source text not null check (source in ('local', 'llm')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.llm_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  cache_key text,
  model text not null,
  prompt_tokens integer,
  completion_tokens integer,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null default 'android' check (platform = 'android'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, token)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete set null,
  request_id uuid references public.pickup_requests_public(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text,
  record_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger pickup_public_set_updated_at before update on public.pickup_requests_public for each row execute procedure public.set_updated_at();
create trigger pickup_private_set_updated_at before update on public.pickup_request_private_details for each row execute procedure public.set_updated_at();

-- Every table is protected. Cache, usage and audit data are service/admin managed.
alter table public.profiles enable row level security;
alter table public.pbt_rule_sets enable row level security;
alter table public.perak_districts enable row level security;
alter table public.scans enable row level security;
alter table public.detections enable row level security;
alter table public.label_feedback enable row level security;
alter table public.feedback_samples enable row level security;
alter table public.pickup_requests_public enable row level security;
alter table public.pickup_request_private_details enable row level security;
alter table public.pickup_waste_items enable row level security;
alter table public.pickup_proofs enable row level security;
alter table public.disputes enable row level security;
alter table public.instruction_cache enable row level security;
alter table public.llm_usage enable row level security;
alter table public.push_tokens enable row level security;
alter table public.reports enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_select_own on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_insert_own on public.profiles for insert with check (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

create policy rules_read_authenticated on public.pbt_rule_sets for select to authenticated using (true);
create policy rules_admin_write on public.pbt_rule_sets for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy districts_read_authenticated on public.perak_districts for select to authenticated using (true);
create policy districts_admin_write on public.perak_districts for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy scans_own on public.scans for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy detections_own on public.detections for all to authenticated using (exists (select 1 from public.scans s where s.id = scan_id and (s.user_id = auth.uid() or public.is_admin()))) with check (exists (select 1 from public.scans s where s.id = scan_id and (s.user_id = auth.uid() or public.is_admin())));
create policy feedback_own on public.label_feedback for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy feedback_samples_admin on public.feedback_samples for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy pickup_public_read_authenticated on public.pickup_requests_public for select to authenticated using (true);
create policy pickup_public_insert_own on public.pickup_requests_public for insert to authenticated with check (requester_id = auth.uid());
create policy pickup_public_update_participant on public.pickup_requests_public for update to authenticated using (requester_id = auth.uid() or collector_id = auth.uid() or public.is_admin()) with check (requester_id = auth.uid() or collector_id = auth.uid() or public.is_admin());
create policy pickup_public_delete_requester on public.pickup_requests_public for delete to authenticated using (requester_id = auth.uid() or public.is_admin());

create policy pickup_private_participant on public.pickup_request_private_details for select to authenticated using (exists (select 1 from public.pickup_requests_public r where r.id = request_id and (r.requester_id = auth.uid() or r.collector_id = auth.uid() or public.is_admin())));
create policy pickup_private_requester_insert on public.pickup_request_private_details for insert to authenticated with check (exists (select 1 from public.pickup_requests_public r where r.id = request_id and (r.requester_id = auth.uid() or public.is_admin())));
create policy pickup_private_requester_update on public.pickup_request_private_details for update to authenticated using (exists (select 1 from public.pickup_requests_public r where r.id = request_id and (r.requester_id = auth.uid() or public.is_admin()))) with check (exists (select 1 from public.pickup_requests_public r where r.id = request_id and (r.requester_id = auth.uid() or public.is_admin())));

create policy waste_participant on public.pickup_waste_items for all to authenticated using (exists (select 1 from public.pickup_requests_public r where r.id = request_id and (r.requester_id = auth.uid() or r.collector_id = auth.uid() or public.is_admin()))) with check (exists (select 1 from public.pickup_requests_public r where r.id = request_id and (r.requester_id = auth.uid() or r.collector_id = auth.uid() or public.is_admin())));
create policy proofs_participant on public.pickup_proofs for all to authenticated using (uploaded_by = auth.uid() or exists (select 1 from public.pickup_requests_public r where r.id = request_id and (r.requester_id = auth.uid() or r.collector_id = auth.uid())) or public.is_admin()) with check (uploaded_by = auth.uid() or public.is_admin());
create policy disputes_participant on public.disputes for all to authenticated using (raised_by = auth.uid() or resolved_by = auth.uid() or public.is_admin()) with check (raised_by = auth.uid() or public.is_admin());

create policy instruction_cache_read_authenticated on public.instruction_cache for select to authenticated using (true);
create policy instruction_cache_admin_write on public.instruction_cache for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy llm_usage_admin_read on public.llm_usage for select to authenticated using (public.is_admin());
create policy push_tokens_own on public.push_tokens for all to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy reports_own_or_admin on public.reports for all to authenticated using (reporter_id = auth.uid() or public.is_admin()) with check (reporter_id = auth.uid() or public.is_admin());
create policy audit_admin_only on public.audit_log for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Storage is private; object paths must begin with the authenticated user's id.
insert into storage.buckets (id, name, public) values ('scans', 'scans', false), ('proofs', 'proofs', false), ('models', 'models', false)
on conflict (id) do update set public = excluded.public;
create policy scans_objects_owner on storage.objects for all to authenticated using (bucket_id = 'scans' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'scans' and (storage.foldername(name))[1] = auth.uid()::text);
create policy proofs_objects_owner on storage.objects for all to authenticated using (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy models_authenticated_read on storage.objects for select to authenticated using (bucket_id = 'models');
create policy models_admin_write on storage.objects for all to authenticated using (bucket_id = 'models' and public.is_admin()) with check (bucket_id = 'models' and public.is_admin());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pickup_requests_public') then
    alter publication supabase_realtime add table public.pickup_requests_public;
  end if;
end $$;
