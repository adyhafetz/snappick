-- Reusable Cleaner: Clean all transactional/activity/scan data while preserving user accounts and profiles.

BEGIN;

-- 1. Remove pickup ratings and disputes
DELETE FROM public.pickup_ratings;
DELETE FROM public.disputes;

-- 2. Remove collection proofs
DELETE FROM public.pickup_proofs;

-- 3. Remove waste items and private pickup details
DELETE FROM public.pickup_waste_items;
DELETE FROM public.pickup_request_private_details;

-- 4. Remove public pickup requests
DELETE FROM public.pickup_requests_public;

-- 5. Remove ML feedback samples and label feedbacks
DELETE FROM public.feedback_samples;
DELETE FROM public.label_feedback;

-- 6. Remove detections and scans
DELETE FROM public.detections;
DELETE FROM public.scans;

-- 7. Reset profile rating aggregates (safely bypassing admin check trigger)
ALTER TABLE public.profiles DISABLE TRIGGER profiles_prevent_privilege_escalation;

UPDATE public.profiles
SET rating_avg = 5.00,
    rating_count = 0;

ALTER TABLE public.profiles ENABLE TRIGGER profiles_prevent_privilege_escalation;

COMMIT;
