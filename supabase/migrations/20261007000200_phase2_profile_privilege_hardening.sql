-- Prevent a user from granting or retaining admin privileges through the
-- self-service profile insert/update policies. Admin tooling can still change it.
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and new.is_admin then
    raise exception 'only an existing admin may grant admin privileges';
  end if;
  if tg_op = 'UPDATE' and not public.is_admin() and new.is_admin <> old.is_admin then
    raise exception 'only an existing admin may change admin privileges';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_privilege_escalation on public.profiles;
create trigger profiles_prevent_privilege_escalation
  before insert or update on public.profiles
  for each row execute procedure public.prevent_profile_privilege_escalation();
