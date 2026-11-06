# Backend checks

`remote-e2e.mjs` runs against the **remote** Supabase project (the one the app uses), signed in as the two test accounts: user A as the requester and user B as the collector. It checks permissions, privacy, proof-photo rules, disputes, ratings and request limits (33 checks).

It creates and cancels pickup requests, so it only runs when you set `E2E_CONFIRM_REMOTE=yes`. See the top of the file and [../../docs/DEVELOPMENT_GUIDE.md](../../docs/DEVELOPMENT_GUIDE.md) for the environment variables.

```powershell
npm install
npm run test:remote
```

Test requests it leaves behind (one completed, one disputed) can be removed with `scripts/clean_database.sql`.
