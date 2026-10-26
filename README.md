# Fitness Level

Fitness Level is an Android workout tracker built with Expo, React Native, and TypeScript. People can sign in with Google or an email/password account, set a fitness goal and equipment, follow generated daily workouts, and track progress, XP, streaks, badges, and optional weight goals.

## What the app stores

- Supabase Auth manages Google and email/password accounts.
- Supabase Postgres stores profiles, workout sets, XP history, optional weights, and age/document acknowledgements.
- PostgreSQL row-level security restricts every user table to the signed-in account. The Android client contains only the Supabase publishable key; the service-role key is used only by the server-side account-deletion function.
- Android stores the Supabase session in Expo SecureStore.
- The public Free Exercise DB catalog is bundled with the app and cached locally in SQLite.
- Workout reminders are optional local Android notifications.

## Stack and structure

```text
App.tsx                              Auth bootstrap and main navigation
src/screens/LoginScreen.tsx          Google and email/password sign-in/create account
src/screens/ConsentScreen.tsx        Age and document acknowledgement
src/screens/OnboardingFlow.tsx       Fitness profile setup
src/screens/TodayScreen.tsx          Daily workout and completion
src/screens/ProgressScreen.tsx       XP, streak, badges, history
src/screens/ProfileScreen.tsx        Goals, weights, reminders, deletion, legal docs
src/services/supabase.ts             Supabase client and secure session storage
src/services/userData.ts             Typed cloud data access, RLS-backed tables
src/services/dailySetGenerator.ts    Daily exercise selection from local catalog
src/db/database.ts                  Local public exercise/level catalog only
supabase/migrations/                 Postgres schema, grants, and RLS policies
supabase/functions/delete-account/   Server-side Auth user deletion
eas.json                             Android development, preview, production profiles
docs/supabase-setup.md               Supabase, OAuth, EAS, and release setup steps
SECURITY.md                          Security design and release limitations
```

## Set up Supabase and sign-in

Follow [docs/supabase-setup.md](docs/supabase-setup.md) to create the Supabase project, configure Google and email auth, apply the database migration, deploy account deletion, and configure EAS. The Android OAuth callback is `fitnesslevel://auth/callback`.

Copy `.env.example` to `.env` and enter the Supabase project URL and publishable key. Those are public app configuration values; never put the Supabase service-role key or Google client secret in the app. `.env` is ignored by Git.

Email account creation may require email confirmation, depending on Supabase Auth settings. Google sign-in requires a configured Google provider and matching Supabase redirect allowlist. Those dashboard credentials are not stored in this repository.

## Install and run

```sh
npm ci
npm run start
```

The `android` shortcut starts Expo for an Android emulator or device:

```sh
npm run android
```

The app uses Expo SDK 58. Google OAuth uses the project-specific Android scheme and should be verified in a development build. Android Expo Go can preview this app after applying the checked-in `expo-notifications` compatibility patch; Expo Go still does not support remote push notifications, though this app uses local reminders. On upgrade, the app offers to import a previous local profile, workout and XP history, and optional weights into the Supabase account, or erase that old local data.

Run local checks with `npm run typecheck`, `npm run lint`, `npm test`, `npx expo-doctor`, and `npm run security:audit`. The SDK 58 project requires Node.js 22.14.0 or newer on the Node 22 line.

## Android release builds

The current Android package candidate is `com.fitnesslevel.tracker`; confirm it is available in Play Console before the first production upload. Version code is set to `1` in `app.json` and must be incremented for each Play update.

```sh
eas build --platform android --profile preview
eas build --platform android --profile production
```

The project does not configure OTA updates or crash reporting. The final build, Play Data Safety form, permission behavior, OAuth callback, deletion flow, and RLS behavior still need real-project/device verification.

## Legal and privacy

The privacy policy and terms are still drafts, and business/support contact values in `src/config/business.ts` are placeholders. Complete those and obtain legal review before public release. The app currently sets its age threshold to 13; age is self-attested, so confirm that this matches the intended audience and launch jurisdictions.

## Third-party data and licensing

The exercise catalog and attribution information are under `assets/free-exercise-db/`; see its `LICENSE.md` and README. npm dependency findings and the limits of the current security review are recorded in [SECURITY.md](SECURITY.md).
