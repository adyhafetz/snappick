-- Migration 20261025000100: Drop legacy unused RPC functions from early Phase 6
drop function if exists public.resolve_rule_set(double precision, double precision);
drop function if exists public.reserve_guidance_llm_budget(integer, text);

