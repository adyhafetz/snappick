-- Phase 10 fix: Remove DISTINCT from update_collector_count_match to fix Postgres 42P10
-- 'for SELECT DISTINCT, ORDER BY expressions must appear in select list'

create or replace function public.update_collector_count_match(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor        uuid := auth.uid();
  req          public.pickup_requests_public%rowtype;
  scan_rec     record;
  counts_match boolean;
  det_class    text;
  det_count    integer;
  col_count    integer;
begin
  if actor is not null then
    select r.* into req
    from public.pickup_requests_public r
    where r.id = p_request_id
      and (r.requester_id = actor or r.collector_id = actor or public.is_admin());
  else
    select r.* into req
    from public.pickup_requests_public r
    where r.id = p_request_id;
  end if;

  if not found then
    raise exception using errcode = 'P0001', message = 'REQUEST_NOT_FOUND';
  end if;

  -- For each scan associated with this request's requester,
  -- attempt a class-level count comparison with the collector results.
  -- Scans are linked by requester_id matching the request's requester_id
  -- and created before the request was submitted.
  for scan_rec in
    select s.id as scan_id, s.user_id, s.training_opt_in
    from public.scans s
    where s.user_id = req.requester_id
      and s.created_at <= coalesce(req.submitted_at, req.created_at, now()) + interval '10 seconds'
      and exists (
        select 1 from public.feedback_samples fs
        where fs.scan_id = s.id and fs.review_status = 'pending'
      )
    order by s.created_at desc
    limit 1  -- most recent scan before submission
  loop
    counts_match := true;

    -- Compare per-class totals between detector and collector.
    for det_class, det_count in
      select d.app_class, count(*)::integer
      from public.detections d
      where d.scan_id = scan_rec.scan_id
        and d.source = 'detector'
      group by d.app_class
    loop
      select coalesce(sum(w.collector_quantity), 0) into col_count
      from public.pickup_waste_items w
      where w.request_id = p_request_id
        and w.app_class = det_class
        and coalesce(w.collector_quantity, 0) > 0;

      if col_count <> det_count then
        counts_match := false;
        exit;
      end if;
    end loop;

    -- Also check reverse: any collector class not in detector?
    if counts_match then
      for det_class in
        select w.app_class
        from public.pickup_waste_items w
        where w.request_id = p_request_id
          and coalesce(w.collector_quantity, 0) > 0
          and not exists (
            select 1 from public.detections d
            where d.scan_id = scan_rec.scan_id
              and d.source = 'detector'
              and d.app_class = w.app_class
          )
      loop
        counts_match := false;
        exit;
      end loop;
    end if;

    -- Update the feedback_samples row for this scan.
    update public.feedback_samples fs
    set collector_count_match = counts_match,
        -- If counts mismatch, mark selection_reason for active learning if not already set
        selection_reason = case
          when not counts_match and fs.selection_reason is null then 'mismatch'
          else fs.selection_reason
        end,
        -- Promote D→B when: counts match, training opted in, no prior correction.
        label_tier = case
          when counts_match
               and scan_rec.training_opt_in
               and fs.label_tier = 'D'
          then 'B'
          else fs.label_tier
        end
    where fs.scan_id = scan_rec.scan_id;
  end loop;
end;
$$;

revoke all on function public.update_collector_count_match(uuid) from public, anon;
grant execute on function public.update_collector_count_match(uuid) to authenticated;

