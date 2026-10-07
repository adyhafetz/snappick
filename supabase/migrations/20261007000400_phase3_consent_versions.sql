-- Phase 3: version the consent records so future wording changes can require
-- a fresh acknowledgement without changing the meaning of the booleans.

alter table public.profiles
  add column if not exists image_storage_consent_version integer,
  add column if not exists community_pickup_safety_acknowledged_version integer;

alter table public.profiles
  drop constraint if exists profiles_image_storage_consent_version_check,
  drop constraint if exists profiles_community_safety_consent_version_check;

alter table public.profiles
  add constraint profiles_image_storage_consent_version_check
    check (image_storage_consent_version is null or image_storage_consent_version > 0),
  add constraint profiles_community_safety_consent_version_check
    check (community_pickup_safety_acknowledged_version is null or community_pickup_safety_acknowledged_version > 0);
