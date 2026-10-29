# Supabase integration tests

Install once from this directory with `npm install`.

The test suites verify Row-Level Security (RLS) isolation, pickup creation, collector marketplace claims, claim expiry cron behaviour, completion proof & notification flows, and active-learning feedback capture.

## Running test suites

Configure environment variables:

```powershell
$env:SUPABASE_URL = "http://127.0.0.1:54321" # or your remote Supabase URL
$env:SUPABASE_ANON_KEY = "<anon-key>"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service-role-key>" # required for feedback & admin setup
$env:TEST_USER_A_EMAIL = "test_a@example.com"
$env:TEST_USER_A_PASSWORD = "<password>"
$env:TEST_USER_B_EMAIL = "test_b@example.com"
$env:TEST_USER_B_PASSWORD = "<password>"
$env:TEST_USER_C_EMAIL = "test_c@example.com"
$env:TEST_USER_C_PASSWORD = "<password>"
```

Available test commands:

```powershell
# Phase 2 & 3: RLS isolation between users and private table protections
npm run test:rls

# Phase 7: Pickup request creation, geofence area resolution, cancellation
npm run test:pickup

# Phase 8: Marketplace claim concurrency, 3-active-jobs cap, release
npm run test:marketplace

# Phase 8: Unstarted-claim expiry cron job simulation
npm run test:expiry

# Phase 9: Completion checklist, proof metadata, auto-completion, dispute & relist
npm run test:completion

# Phase 10: Feedback capture, label tiers (A/B/C/D), active learning gating, home stats
npm run test:feedback
```
