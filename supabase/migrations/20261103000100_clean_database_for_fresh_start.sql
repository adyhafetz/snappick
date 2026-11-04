-- Migration 20261103000100: Clean transactional data for fresh start (preserve users and profiles)

delete from public.pickup_ratings;
delete from public.disputes;
delete from public.pickup_proofs;
delete from public.pickup_waste_items;
delete from public.pickup_request_private_details;
delete from public.pickup_requests_public;
delete from public.feedback_samples;
delete from public.label_feedback;
delete from public.detections;
delete from public.scans;

