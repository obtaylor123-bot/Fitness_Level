# Security and release readiness

Reviewed: October 26, 2026. This is a repository and local-tooling review. No linked Supabase project, deployed Edge Function, Google OAuth configuration, signed Android release, production account, or physical-device test was available. This document records code-level controls and remaining release gates; it is not a legal opinion or penetration-test certification.

## Security controls in the repository

- User profiles, consent records, workouts, and XP are stored in Supabase. The migration enables row-level security, grants table access only to authenticated users, and constrains every operation to `auth.uid()`. The bundled exercise catalog is public app content.
- The initial migration defines four user-data tables, `auth.users` cascade foreign keys, owner-only policies for all commands, and no grants or policies to `anon`. Repository search found no SQL views or `SECURITY DEFINER` functions that could bypass RLS. This does not inventory objects created directly in a remote Supabase project.
- The Android client uses only the Supabase URL and publishable key. The service-role key is read only by the `delete-account` Edge Function, which verifies the bearer token with Supabase Auth, derives the user ID from that verified identity, ignores caller-supplied IDs, and deletes only that account.
- Google sign-in uses the Supabase OAuth flow and `fitnesslevel://auth/callback`. Google client secrets belong in Supabase provider configuration, not in the app.
- Android auth sessions use SecureStore. A recovery marker retries local deletion cleanup after cloud account deletion. Cloud deletion happens before local destructive cleanup, so a failed cloud request leaves local data and the session available for retry.
- The Expo Go failure in the supplied screenshots was traced to Expo Notifications eagerly requiring `ExpoTopicSubscriptionModule`, which the installed Expo Go native client did not contain. `patches/expo-notifications+58.1.6.patch` applies the upstream optional-module behavior at install time. This enables local notification APIs in Expo Go; remote push notifications are not supported there. Confirm on the user's current Expo Go build and a standalone Android build.
- Login requires self-confirmation of age 13+ and acknowledgement of the current privacy/terms documents before starting authentication. This is self-attestation, not age verification. The stated audience “everyone” needs a product decision for under-13 users and Google Play Families requirements before listing.
- Account age and legal copy, contact/business identity, hosted privacy policy and web deletion request page remain drafts pending real business details, support process, and legal review.
- The deletion function has no app-specific rate limiter. It requires a verified Supabase JWT and deletes only that authenticated account; enable platform abuse monitoring and consider request throttling if traffic or abuse warrants it.

## Automated verification

The repository now defines typecheck, lint, Jest tests, Expo Doctor, and an audit allowlist check in CI. The audit gate permits only the two precisely identified upstream findings below until November 26, 2026; it fails for new or expired high/critical findings. Re-run all checks after any dependency change.

`npm audit` and `npm audit --omit=dev` reported five high-severity paths involving:

- `GHSA-86w9-cpqp-85rv` in `node-forge`, pulled by Expo code-signing tooling.
- `GHSA-mrhx-c7xc-m3w5` in Zod 3, pulled by Expo CLI.

The Expo CLI/signing chain is used by developer and CI tooling, not bundled app runtime code. Android export source-map search found no `node-forge` or `node_modules/zod` source in the app bundle. The string `zod` appears only alongside Expo runtime loader metadata, not a Zod module. `ExpoTopicSubscriptionModule` and `requireOptionalNativeModule` appear as expected in the bundle. Registry checks on October 26, 2026 found `node-forge@1.4.0`, `@expo/code-signing-certificates@0.0.7` (still depends on `node-forge ^1.4.0`), and `@expo/cli@58.1.15` (still selects Zod 3). The installed app tree also includes Zod 3 through lint tooling, but the bundle scan found no Zod module source. No broad override was applied because the Zod advisory fix is in v4 while Expo CLI declares v3, and Expo signing's current package range still includes the affected node-forge version. Do not use `npm audit fix --force`; it may downgrade Expo across major SDK versions. `scripts/check-audit.mjs` documents and expires the temporary acceptance. Recheck upstream advisories and npm audit before release.

## Release gates requiring external configuration or device access

1. Configure Supabase Google/email providers, callback allowlist, project URL and publishable key in EAS development/preview/production environments. Keep service-role and Google client secrets server-side.
2. Apply the SQL migration to the intended Supabase project. Run `node scripts/test-rls.mjs` against a disposable local project with two disposable users. Do not claim production RLS is verified until equivalent tests pass against the release project.
3. Deploy `delete-account` and set its server-side secrets. For browser deletion requests, configure exact allowed HTTPS origins. Test deletion online, offline, partial local cleanup, and the external request workflow.
4. Replace business/support/address placeholders. Publish the privacy policy and functional external account-deletion page; add the deletion URL in Play Console. The current web page is only a support-email draft.
5. Review Supabase region, backups, retention, administrator access, processor terms, and applicable privacy obligations. Finish Play Data Safety, age rating, Google Play Families assessment, and store disclosures from the actual release configuration.
6. Build and install a signed Android preview/release. Inspect the final merged manifest and AAB for target API, package ID, permissions, backup policy, and signing identity. SDK 58 targets Android API 36 per the current Expo reference, meeting the Play target requirement in force from August 31, 2026; still verify the produced artifact and recheck Play policy at submission.
7. Perform the device checks in `docs/device-test-plan.md`, including TalkBack, keyboard navigation, font scaling, auth refresh, offline behavior, reminders, upgrade/migration, account deletion, and reinstall/update behavior. Expo Go testing alone does not validate release-native behavior.

The current local environment did not have Supabase CLI, EAS CLI, production credentials, or an Android device attached, so these deployment and runtime checks remain outstanding. No vulnerability scan can certify an app as “fully secure”; this is a documented engineering review with explicit verification limits.

## Expo SDK 58 decision

The project moved from SDK 57 to SDK 58 to match the installed Expo Go client shown in the screenshot. The SDK 58 upgrade, Expo Doctor, typecheck, and Android export succeeded. App-relevant areas include React Native 0.88 / React 19.3 type and API updates, Notifications local scheduling and Android permission behavior, SecureStore Android options, and Expo SQLite's native module. This app uses Supabase JS 2.118.0 for PKCE and SecureStore persistence, `expo-notifications` for local reminders, and `expo-sqlite` for catalog/legacy migration. Automated checks pass; OAuth, SecureStore, reminder delivery, SQLite migration, and release-native behavior still need device tests. SDK 58 does not remove either npm advisory. No Zod major override was attempted.

## Review task status

| Area | Status |
| --- | --- |
| Expo Go native-module crash and SDK 58 compatibility patch | Code fix and Android export complete; Expo Go/device launch needs you |
| Known build-tool advisories and CI allowlist | Rechecked and documented; no compatible upstream fix; allowlist expires November 26, 2026 |
| Typecheck, lint, Jest, Expo Doctor, dependency check | Passed locally; lint still reports 8 warnings |
| Supabase RLS migration/function review and repeatable test | Code-reviewed and test script prepared; Supabase CLI/Docker unavailable, no database execution |
| Account deletion and recovery | Code updated and unit-tested; deployed cloud and device paths need you |
| Privacy, terms, Play disclosures, deletion web stub | Drafts updated; owner details, legal review, hosting, Play Console setup need you |
| Android release config and permissions | Source config reviewed; final AAB/merged manifest/signing need you |
| Accessibility | Theme centralized and device plan added; selected theme contrast pairs measured; full TalkBack, keyboard, scaling, and touch-target review needs device verification |
| Crash reporting | No SDK added; decision below |

### Crash reporting decision

Keep crash reporting out of the first release. Crash collection can improve diagnosis, but adds a processor/SDK, identifiers and diagnostics to assess, and privacy-policy and Play Data Safety disclosures. First ship with privacy-preserving local error handling and support diagnostics. If later approved, choose a provider, minimize or scrub identifiers and breadcrumbs, configure retention/deletion, update privacy and Data Safety disclosures, and validate Android permissions and network behavior.

## Needs you — in order

1. **Supabase/Auth:** create or select the release project and note project ref and region. Enable Google and email/password in Supabase Auth. Configure Google Cloud OAuth and store its client ID/secret only in Supabase. Allow `fitnesslevel://auth/callback` in Supabase redirects. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in each EAS development, preview, and production environment.
2. **Local RLS verification:** install Docker and Supabase CLI, run `supabase start`, create two disposable users in its local Auth stack, then set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RLS_TEST_USER_A_EMAIL`, `RLS_TEST_USER_A_PASSWORD`, `RLS_TEST_USER_B_EMAIL`, and `RLS_TEST_USER_B_PASSWORD` in the shell and run `node scripts/test-rls.mjs`. Fix any failure before proceeding.
3. **Production DB/function:** verify the active project ref before any write, then run `supabase login`, `supabase link --project-ref <release-project-ref>`, and `supabase db push`. Run `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>`. Set `DELETE_ACCOUNT_ALLOWED_ORIGINS` to the exact HTTPS web origin if needed, then run `supabase functions deploy delete-account`. Keep secrets out of this repo and all `EXPO_PUBLIC_*` values.
4. **Staging verification:** test Google/email with two accounts and run the RLS script against a dedicated staging project. Review Supabase region, backups, retention, dashboard access, and processor/DPA terms.
5. **Legal/Play:** replace placeholders below, obtain legal review, publish the policy and working external account deletion page, and enter both URLs in Play Console. Complete age rating, audience/Families determination, and Data Safety answers against deployed services.
6. **Android:** install EAS CLI and run `eas build --platform android --profile preview`; install and finish `docs/device-test-plan.md`. Then `eas build --platform android --profile production`. Inspect with `bundletool dump manifest --bundle <path-to-app.aab>` and verify API 36, package `com.fitnesslevel.tracker`, versionCode, permissions, exported components, backup/cleartext settings, scheme, and signing certificate.
7. **Submission recheck:** run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npx expo-doctor`, `npm audit`, `npm audit --omit=dev`, and `npm run security:audit`. Review new/expired findings and recheck current Play policy before upload.

### Placeholders

- `src/config/business.ts`: `{{BUSINESS_NAME}}`, `{{SUPPORT_EMAIL}}`, `{{PHYSICAL_ADDRESS}}`, `{{WEBSITE}}`.
- `web/account-deletion.html`: business/support details, hosted request URL, and an operational identity-verified request process. It is currently a mailto draft.
- Service consoles only: Supabase project URL/ref/region, publishable key, OAuth provider credentials, redirect allowlist, function secrets, and EAS environment values. Do not put secrets in this repository.
- Play Console: public privacy-policy URL and external account-deletion URL.

### Open decisions

- **SDK 58:** upgraded to match the installed Expo Go SDK; retain after release-like device testing.
- **Crash reporting:** recommended to defer for first release.
- **Web deletion:** choose a staffed email request workflow or verified self-service flow, then host and test it.
- **Age/audience:** code requires self-attested 13+, while the product was described as for “everyone.” Decide whether under-13 users are excluded and assess Google Play Families requirements.
- **Retention/legal copy:** confirm actual Supabase backup deletion timing and have privacy/terms reviewed by qualified counsel.
