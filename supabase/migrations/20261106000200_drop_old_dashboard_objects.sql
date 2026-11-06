-- Migration 20261106000200: remove the old public-dashboard views and the drift data behind them
--
-- The earlier public dashboard design (business-style KPIs and model monitoring) was scrapped. The new
-- public website and community dashboard will define their own published summary tables. Nothing in
-- the app or the admin dashboard reads these. No CASCADE is used, so this fails instead of silently
-- dropping anything that still depends on them.

drop view if exists public.dashboard_overview_kpis;
drop view if exists public.dashboard_pickup_trends;
drop view if exists public.dashboard_material_breakdown;
drop view if exists public.dashboard_district_aggregates;
drop view if exists public.dashboard_model_transparency;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'compute-daily-drift-job';
  end if;
end $$;

drop function if exists public.compute_drift_daily(date);
drop table if exists public.drift_daily;
