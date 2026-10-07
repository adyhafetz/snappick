# SnapPick

SnapPick is an Android-only community recycling pilot for Perak. The repository contains independent package roots for the Expo mobile app, Supabase project, and later ML and dashboard work.

## Phase 1

The mobile app uses Expo SDK 57, Expo Router, TypeScript, and Supabase email/password authentication. Copy `apps/mobile/.env.example` to `apps/mobile/.env`, set the public Supabase URL and anon key, then run:

```text
cd apps/mobile
npm install
npx tsc --noEmit
npx expo start
```

Native Android development builds use `npx expo run:android` and require a connected Android device or emulator.
