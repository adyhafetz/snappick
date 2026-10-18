-- Releasing an unstarted claim always returns it to pending, even after its pickup window.
create or replace function public.release_pickup_request(request_id uuid)
returns table (id uuid, status public.pickup_request_status)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  return query update public.pickup_requests_public r
    set collector_id = null, claimed_at = null, status = 'pending'
    where r.id = request_id and r.collector_id = auth.uid() and r.status = 'accepted'
    returning r.id, r.status;
  if not found then raise exception using errcode = 'P0001', message = 'REQUEST_NOT_RELEASABLE'; end if;
end;
$$;
revoke all on function public.release_pickup_request(uuid) from public, anon;
grant execute on function public.release_pickup_request(uuid) to authenticated;
