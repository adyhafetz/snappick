# Phase 2 Checklist

## A. Manual work before testing

- [x] One-time: confirm the Supabase project is linked (`npx supabase link`).
- [ ] One-time: create two throwaway email/password users in the mobile app or Supabase Dashboard -> Authentication -> Users. Record both credentials locally; do not commit them.
- [ ] Per-run: ensure Docker Desktop is running when using the local Supabase stack.

## B. Setup and run commands

From `C:\Projects\snappick`:

```powershell
npx supabase db reset
npx supabase db push
cd supabase/tests
npm install
$env:SUPABASE_URL = "https://<project>.supabase.co"
$env:SUPABASE_ANON_KEY = "<anon-key>"
$env:TEST_USER_A_EMAIL = "snappick-test-a@example.com"
$env:TEST_USER_A_PASSWORD = "<password>"
$env:TEST_USER_B_EMAIL = "snappick-test-b@example.com"
$env:TEST_USER_B_PASSWORD = "<password>"
npm run test:rls
```

For a linked hosted project, use `npx supabase db push` instead of resetting.

## C. Tests

1. Run `npx supabase db push` -> expect the Phase 2 migration to apply without SQL errors.
2. Run `npx supabase db reset` -> expect `perak_general` version 1 and the placeholder Perak district to exist.
3. Sign up a new user -> expect one matching row in Supabase -> Table Editor -> `profiles`.
4. Run the SQL query `select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;` -> expect every Phase 2 table to show `rowsecurity = true`.
5. Run `npm run test:rls` in `supabase/tests` with the two test users -> expect the isolation success message; user A cannot read user B's profile or scan, and anonymous access to private pickup details returns no rows.
6. Query `select name, version, jsonb_object_keys(rules->'classes') from public.pbt_rule_sets where name = 'perak_general';` -> expect all 13 class names and version `1`.

## D. Regression

- [ ] Phase 1 email sign-in still creates or uses an authenticated session.
- [ ] The mobile app still typechecks and lint checks (`cd apps/mobile; npm run typecheck; npm run lint`).
- [ ] `apps/mobile/.env` remains ignored and no secret key is present in migrations, seed data, or tests.

## E. Known limitations

- District geometry is a clearly marked placeholder and must be replaced with verified boundaries before pickup requests are enabled.
- Pickup lifecycle RPCs and ML registry tables are intentionally deferred to their later phases.
- The RLS script requires two manually created users and a reachable Supabase project; it is not a simulated test.

## F. Troubleshooting

- `relation "postgis" does not exist`: enable the PostGIS extension in Supabase Dashboard -> Database -> Extensions, then rerun the migration.
- `Docker is not running`: start Docker Desktop before `npx supabase db reset`.
- `Invalid login credentials`: verify both throwaway users exist and the environment variables contain their exact passwords.
- `permission denied for table ...`: confirm the migration completed and rerun the RLS test with the anon key, never a service-role key.

## G. Sign-off

```powershell
git add supabase docs/phases/PHASE-2-CHECKLIST.md docs/PROGRESS.md docs/ENVIRONMENT.md
git commit -m "feat: phase 2 database and security foundation"
git checkout main
git merge phase-2
git tag phase-2-done
```

After verification, update `docs/PROGRESS.md` to mark Phase 2 complete.

## Automated tests

- `supabase/tests/rls.test.mjs` - `cd supabase/tests; npm install; npm run test:rls`.
- SQL verification query in section C item 4 checks that every public table has RLS enabled.

## Assumptions

- Supabase CLI 2.119.0 and `@supabase/supabase-js` 2.117.2 are the versions available in this repository environment.
- The linked Supabase project permits PostGIS and the standard `storage` schema policies.
- A service-role key is not needed for the user-facing isolation test and is intentionally excluded.
