-- Phase 9 addition: create push_tokens table and update notify trigger to check Supabase Vault.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null default 'android' check (platform = 'android'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, token)
);

alter table public.push_tokens enable row level security;

drop policy if exists push_tokens_own on public.push_tokens;
create policy push_tokens_own on public.push_tokens
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create or replace function public.notify_pickup_status_change()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  endpoint text := current_setting('app.supabase_url', true);
  anon_key text := current_setting('app.supabase_anon_key', true);
  secret text := current_setting('app.notify_secret', true);
begin
  if endpoint is null and exists (select 1 from pg_extension where extname = 'supabase_vault') then
    select decrypted_secret into endpoint from vault.decrypted_secrets where name = 'app.supabase_url' limit 1;
  end if;
  if anon_key is null and exists (select 1 from pg_extension where extname = 'supabase_vault') then
    select decrypted_secret into anon_key from vault.decrypted_secrets where name = 'app.supabase_anon_key' limit 1;
  end if;
  if secret is null and exists (select 1 from pg_extension where extname = 'supabase_vault') then
    select decrypted_secret into secret from vault.decrypted_secrets where name = 'app.notify_secret' limit 1;
  end if;

  if endpoint is not null and anon_key is not null and old.status is distinct from new.status then
    perform net.http_post(
      endpoint || '/functions/v1/notify',
      jsonb_build_object('request_id', new.id, 'status', new.status::text),
      jsonb_build_object('Content-Type', 'application/json', 'apikey', anon_key, 'x-notify-secret', secret),
      '{}'::jsonb,
      5000
    );
  end if;
  return new;
end;
$$;

