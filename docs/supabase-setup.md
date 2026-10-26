# Supabase and Android release setup

The Android app uses Supabase Auth and Postgres for accounts, profiles, workout history, optional weight values, XP history, and consent records. The exercise catalog remains bundled in the app. The client uses only the Supabase project URL and publishable key; it never contains a service-role key.

## 1. Create and configure the Supabase project

1. Create a Supabase project and copy its project URL and publishable key into a local `.env` file based on `.env.example`.
2. In **Authentication → Providers**, enable Google and email/password sign-in. Decide whether email confirmation is required.
3. In **Authentication → URL Configuration**, allow the mobile callback `fitnesslevel://auth/callback`.
4. In Google Cloud Console, configure the OAuth consent screen and a Web OAuth client. Add Supabase's callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`) as an authorized redirect URI. Put the Google client ID and secret into Supabase's Google provider settings; do not put the client secret in the app.
5. Build the Android app and record its package name and signing certificate SHA-1 if the Google provider setup requests them. The current package candidate is `com.fitnesslevel.tracker`; confirm it is available and keep it stable before publishing.

## 2. Apply database security

From the project root, install/use the Supabase CLI, link it to the project, then apply the migration:

```sh
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

Use the SQL migration only against the intended project. Run `node scripts/test-rls.mjs` against a disposable local stack (see the account deletion checklist) before production. The script uses two regular test accounts and the publishable/anon key; it does not need or accept a service-role key.

## Edge Function CORS and deletion

The `delete-account` function verifies its caller and reads the service-role key only from Edge Function secrets. Native calls normally omit an `Origin` header. If you add a browser caller, set `DELETE_ACCOUNT_ALLOWED_ORIGINS` to a comma-separated list of exact HTTPS origins before deployment. The function rejects other browser origins. The web page in `web/account-deletion.html` currently sends a support-email request; it is not a direct API client.

Deploy only after replacing the support placeholders and deciding how the web deletion requests will be identity-verified and completed:

```sh
supabase functions deploy delete-account
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
supabase secrets set DELETE_ACCOUNT_ALLOWED_ORIGINS=https://YOUR_PUBLIC_SITE
```

Do not paste the service-role key into source files or the app's `EXPO_PUBLIC_*` variables. Keep it in Supabase Function secrets.

## EAS environment values

The `development`, `preview`, and `production` EAS profiles select corresponding EAS environments. Add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as public values in each environment in EAS project settings. No Supabase service-role key or Google client secret belongs in any EAS app environment. EAS secrets are not configured from this repository.

`supabase/migrations/202610260001_initial_user_data.sql` creates the app data tables, revokes direct table privileges from `anon`, grants only to `authenticated`, and enables owner-only row-level security on every table. Exercise and level catalogs are not exposed through the Supabase API.

## 3. Deploy secure account deletion

The app's Delete my data action calls an Edge Function. Link/deploy it and configure the Supabase function secrets (the platform provides the project URL and keys to deployed functions):

```sh
supabase functions deploy delete-account
```

The function validates the caller's bearer token, derives the account ID from the verified token, and uses the service-role key only in the server-side function to delete that account. Foreign-key cascades delete its profile, consent, workouts, and XP rows. Never expose `SUPABASE_SERVICE_ROLE_KEY` or any secret in an `EXPO_PUBLIC_` variable.

## 4. Configure EAS

The app defines `development`, `preview`, and `production` Android build profiles in `eas.json`. Configure these EAS environment variables for each profile:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

They are public client configuration values, not authorization by themselves; RLS is the security boundary. Build an internal preview with `eas build --platform android --profile preview` and a production bundle with `eas build --platform android --profile production`.

## 5. Verify before release

- Confirm Google sign-in and the callback on a production-signed Android build, not only Expo Go.
- Test Google and email accounts against RLS using two distinct accounts; neither account may read or alter the other's profile, consent, workouts, or XP rows.
- Test deletion for email and Google accounts; confirm the account and all cascaded rows are gone and local reminders are canceled.
- Complete privacy/terms contact fields, host a public privacy policy, and ensure the policy describes Supabase storage and Google authentication.
- Verify Android's final merged manifest, notification permission behavior, package ID, signing key, Play Data Safety answers, and store listing.

Supabase project secrets, Google OAuth credentials, Play Console registration, and legal/business details are intentionally not fabricated in this repository. Until configured and verified, Google sign-in and cloud data operations cannot run in a release build.
