-- Migration 20261105000600: let an admin delete a rejected model version
--
-- The live (champion) model and the bundled baseline v0 can never be deleted.
-- The function returns the storage path so the admin dashboard can remove the .tflite file too.

create or replace function public.admin_delete_model_version(p_version text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_role text;
  v_path text;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Admin privileges required';
  end if;

  select id, role, storage_path into v_id, v_role, v_path
  from public.model_versions
  where version = p_version;

  if v_id is null then
    raise exception 'Model version % not found', p_version;
  end if;

  if p_version = 'v0' or v_role in ('bundled_fallback', 'champion') then
    raise exception 'The live model and the bundled baseline cannot be deleted';
  end if;

  delete from public.model_versions where id = v_id;

  insert into public.audit_log (actor_id, action, table_name, record_id, metadata)
  values (auth.uid(), 'model_deleted', 'model_versions', v_id, jsonb_build_object('version', p_version));

  return jsonb_build_object('success', true, 'version', p_version, 'storage_path', v_path);
end;
$$;

revoke execute on function public.admin_delete_model_version(text) from public, anon;
grant execute on function public.admin_delete_model_version(text) to authenticated;
