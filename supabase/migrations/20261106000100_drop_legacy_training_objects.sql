-- Migration 20261106000100: remove objects from the retired automated-gate retraining design
--
-- Retraining now works like this: the admin presses Retrain, a Kaggle notebook trains a new model
-- and registers it, and the admin decides on the Models page whether to use it. Nothing in the app,
-- the admin dashboard, the notebook or any view reads these any more. No CASCADE is used, so this
-- fails instead of silently dropping anything that still depends on them.

drop function if exists public.get_ml_retraining_trigger_stats();
drop function if exists public.promote_feedback_sample_to_c(uuid);

-- model_versions.training_run_id and dataset_version_id pointed at these tables; both are unused (all NULL).
alter table public.model_versions drop column if exists training_run_id;
alter table public.model_versions drop column if exists dataset_version_id;

drop table if exists public.training_runs;
drop table if exists public.dataset_versions;
