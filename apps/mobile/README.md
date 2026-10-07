# SnapPick mobile

Android Expo SDK 57 development build for SnapPick. The app uses Expo Router and Supabase email/password authentication.

## Local setup

```text
copy .env.example .env
npm install
npx expo run:android
```

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env` before opening the app. The file is ignored by Git.
