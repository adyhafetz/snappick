# Supabase tests

Install once from this directory with `npm install`. The isolation test uses two
throwaway users and the public anon key; it never needs a service-role key.

PowerShell example:

```powershell
$env:SUPABASE_URL = "https://<project>.supabase.co"
$env:SUPABASE_ANON_KEY = "<anon-key>"
$env:TEST_USER_A_EMAIL = "snappick-test-a@example.com"
$env:TEST_USER_A_PASSWORD = "<password>"
$env:TEST_USER_B_EMAIL = "snappick-test-b@example.com"
$env:TEST_USER_B_PASSWORD = "<password>"
npm run test:rls
```

`rls.test.mjs` signs in both users, verifies profile and scan isolation, checks
anonymous access to private pickup details, and deletes its temporary scan.
