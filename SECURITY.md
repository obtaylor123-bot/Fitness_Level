# Security review and release controls

Reviewed: October 26, 2026. This is a static repository review; no linked Supabase project, deployed Edge Function, Android release build, runtime security test, or penetration test was available.

## Data and authorization design

- Profile, workouts, XP, weight values, and consent records are stored in Supabase Postgres. The exercise/level catalog remains local and public.
- `supabase/migrations/202610260001_initial_user_data.sql` enables RLS on every public user-data table, revokes table privileges from the `anon` and `authenticated` roles before granting the necessary CRUD privileges to `authenticated`, and applies `auth.uid()` ownership checks for every operation.
- The app uses only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. A publishable key is expected in a client app; it is not authorization. RLS is required for safety.
- Supabase sessions use PKCE and are persisted with Expo SecureStore on Android. The service-role key is referenced only by `supabase/functions/delete-account/`, which verifies the caller and deletes only the authenticated caller's account.
- Google OAuth secrets belong in Supabase Auth provider settings. The Android client callback scheme is `fitnesslevel://auth/callback`.
- Age confirmation is required before authentication starts and is repeated with legal-document acknowledgement before profile setup. The minimum age is 13, based on the configured product decision; this is self-attestation, not age verification.
- Account deletion requires internet and the deployed `delete-account` Edge Function. It deletes the Auth user so foreign-key cascades remove cloud data, then removes the previous local database and cancels reminders.

## Required deployment controls

1. Apply the SQL migration to the correct Supabase project and test access with two independent accounts plus an unauthenticated request. Do not treat the SQL source as proof that production RLS is deployed.
2. Deploy `delete-account` and verify its authentication and cascade behavior. Keep `SUPABASE_SERVICE_ROLE_KEY` only in Supabase's Edge Function secrets.
3. Configure email and Google providers and allowlist the Android redirect. Do not ship a Google OAuth client secret.
4. Set EAS environment variables for each build profile. Do not commit `.env` files or secret keys.
5. Review Supabase backups, data region/retention, dashboard administrator access, and applicable processor terms before release.
6. Complete the privacy policy and store data disclosures. The app sends account/profile/workout/weight/consent data to the configured Supabase project and uses Google for sign-in when selected.

## Dependency audit

On October 26, 2026, both `npm audit` and `npm audit --omit=dev` reported five high-severity findings reachable through Expo CLI/signing dependencies:

- `GHSA-86w9-cpqp-85rv` — `node-forge` RSA PKCS#1 v1.5 signature verification accepts extra nested DigestAlgorithm elements.
- `GHSA-mrhx-c7xc-m3w5` — Zod may exhaust memory when validating oversized constrained collections.

The audit output's forced fix would downgrade Expo to 44.0.6; no forced downgrade was applied. The installed chain is `expo@57.0.31` → `@expo/cli@57.0.32` → `@expo/code-signing-certificates@0.0.6` / `node-forge@1.4.0` and `zod@3.25.76`. Registry inspection found current `node-forge` at 1.4.0; the current `@expo/code-signing-certificates@0.0.7` still requests `node-forge ^1.4.0`. Current `@expo/cli@58.1.15` still requests `zod ^3.25.76`, while the advisory fix is Zod 4.6.6 or later. No compatible upstream patched release was identified, and forcing Zod 4 across Expo CLI's Zod 3 dependency is not verified safe, so no override was applied.

`npm audit --omit=dev` also reports these five findings because Expo declares its CLI dependency in the installed package tree. The affected packages are used by local Expo commands and build tooling; Metro does not bundle the Expo CLI/signing toolchain into the Android application JavaScript bundle. They remain a risk on developer and CI build machines. Do not use `npm audit fix --force`; it proposes downgrading Expo to 44.0.6. Recheck when compatible upstream fixes are available.

At audit time, Expo SDK 58 had just been released while this app uses SDK 57. SDK 57's installed patch is current, but an SDK 58 migration should be completed and tested before relying on Expo Go for device testing; otherwise use a project development build. Expo SDK 57 was released June 30, 2026 and SDK 58 October 15, 2026.

## Verification still required

- CI runs `npm ci`, `npm run typecheck`, Expo Doctor, and `npm audit --audit-level=critical`. The known high findings above are documented and do not fail CI; resolve or consciously accept them before release.
- Build a production-signed Android bundle and inspect the final merged manifest, target API, package ID, OAuth redirect, permissions, and SDK privacy behavior.
- Follow [the account-deletion checklist](docs/data-deletion-checklist.md), including a two-account RLS isolation test.
- Test screen-reader, keyboard, network-loss, storage-loss, account deletion, and auth refresh behavior on actual Android devices.

No app-level automated tests, lint command, or crash reporting service is configured. No real Supabase credentials or business/contact details are included in the repository.
