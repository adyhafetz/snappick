-- Migration: ensure pg_net extension exists and fix notify trigger arguments and error resilience

create extension if not exists pg_net with schema extensions;

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
    begin
      perform net.http_post(
        url := endpoint || '/functions/v1/notify',
        body := jsonb_build_object('request_id', new.id, 'status', new.status::text),
        params := '{}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', anon_key, 'x-notify-secret', secret),
        timeout_milliseconds := 5000
      );
    exception when others then
      -- notification failure must never block or roll back the core business transaction
      null;
    end;
  end if;
  return new;
end;
$$;

