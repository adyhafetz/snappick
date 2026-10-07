# SnapPick mobile

Android Expo SDK 57 development build for SnapPick. The app uses Expo Router and Supabase email/password authentication.

## Local setup

```text
copy .env.example .env
npm install
npx expo run:android
```

Set `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and the Google Web OAuth client ID (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`) in `.env` before opening the app. The file is ignored by Git. Google Sign-In uses native code, so use the development build (`npx expo run:android`), not Expo Go, and rebuild after changing native configuration.
