-- Migration 20261102000200: Extend pickup window for test records so they are startable in dev

update public.pickup_requests_public
set pickup_window_start = now() - interval '1 hour',
    pickup_window_end = now() + interval '2 days',
    claimed_at = now()
where status = 'accepted';

