-- A suppressed row must not reveal how many households it has (only that there are fewer than 5).
create or replace function public.public_stats_hide_small_counts()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.suppressed then new.households := 0; end if;
  return new;
end;
$$;

create trigger public_stats_period_hide_small before insert on public.public_stats_period
  for each row execute function public.public_stats_hide_small_counts();
create trigger public_stats_monthly_hide_small before insert on public.public_stats_monthly
  for each row execute function public.public_stats_hide_small_counts();

select public.refresh_public_stats();
