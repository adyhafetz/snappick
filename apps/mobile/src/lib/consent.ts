import type { Profile } from '@/providers/AuthProvider';

export const CONSENT_VERSION = 1;

export function hasImageStorageConsent(profile: Profile | null) {
  return Boolean(
    profile?.image_storage_consent &&
      profile.image_storage_consent_version === CONSENT_VERSION,
  );
}

export function hasSafetyAcknowledgement(profile: Profile | null) {
  return Boolean(
    profile?.community_pickup_safety_acknowledged &&
      profile.community_pickup_safety_acknowledged_version === CONSENT_VERSION,
  );
}

export function hasRequiredConsents(profile: Profile | null) {
  return hasImageStorageConsent(profile) && hasSafetyAcknowledgement(profile);
}
