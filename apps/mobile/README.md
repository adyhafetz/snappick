# SnapPick mobile

Android app built with Expo SDK 57 (React Native 0.86, new architecture), Expo Router and Supabase. It needs a development build; Expo Go does not work.

```powershell
copy .env.example .env
npm install
npx expo run:android      # first time, and after any native change
npx expo start            # day-to-day
npm test                  # unit tests
```

Set `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `.env` (ignored by Git). Rebuild after changing native configuration.

`npm run db:clean`, `db:seed` and `db:reset` act on the linked remote Supabase project, so use them only while it holds test data.

More: [../../docs/DEVELOPMENT_GUIDE.md](../../docs/DEVELOPMENT_GUIDE.md) and [../../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).
