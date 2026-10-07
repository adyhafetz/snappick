# Phase 1 Checklist

## Manual verification

- [x] `apps/mobile/.env` was present with public Supabase values; it is ignored by Git.
- [x] Confirm `adb devices` lists the reference phone with status `device`.
- [x] Run `npx expo run:android` from `apps/mobile`; confirm the development build installs and opens.
- [ ] Edit a placeholder tab screen and confirm the development build hot-reloads.
- [ ] Create a new account; confirm it appears under Supabase Authentication > Users.
- [ ] Try a wrong password; confirm the app shows a readable error.
- [ ] Sign out from Profile; confirm the app returns to sign-in.
- [ ] Force-close and reopen; confirm the saved session remains signed in.
- [ ] Confirm the Scan tab is larger and highlighted in the center.

## Automated verification

- [x] `npm run typecheck` (or `npx tsc --noEmit`) passes in `apps/mobile`.
- [x] `npx expo lint` passes in `apps/mobile`.
- [x] `npx expo-doctor` passes in `apps/mobile`.
- [x] `git status --short` does not show `apps/mobile/.env`.
- [ ] A clean checkout followed by `npm install` in `apps/mobile` typechecks.
- [x] Repository folders match section 5.1 of `docs/SNAPPICK_BUILD_GUIDE.md`.

## Tests and commands

Phase 1 has no unit-test suite; the auth workflow is verified manually against Supabase. Automated commands are listed above.

## Assumptions and limits

- Supabase project credentials were not committed in the starting tree (the local ignored `.env` was available for verification), and the Phase 0 spike archive was absent; no secrets or fabricated spike data were added.
- Email confirmation behavior follows the Supabase project setting. The app handles both immediate sessions and confirmation-required sign-up responses.
- The five tab screens are placeholders by design; data, consent, schema, scanning, maps, and profile persistence belong to later phases.
- Android native build/install verification depends on the developer machine's Android SDK and connected phone and was not claimed without running it.
