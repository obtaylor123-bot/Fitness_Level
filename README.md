# Fitness Level

Fitness Level is an Expo and React Native app written in TypeScript for tracking workouts and daily exercise goals. It includes a Today view for a generated daily exercise set, a Progress view for workout history and experience points, and a Profile view for settings and account controls.

## Features

- Onboarding and an age/consent step before entering the app.
- Daily exercise sets generated from the included exercise data.
- Workout progress, experience points, and badge data.
- Local persistence using SQLite on native platforms and browser storage on web.
- Optional local workout reminders, requested when enabled.
- Optional Google sign-in flow; OAuth client IDs must be configured for the target platforms.
- Profile controls, including local data deletion.
- Draft privacy policy and terms of service shown in the app.

Workout and profile data are stored on the device. This project does not currently provide a cloud account database or cloud synchronization. The legal text, business details, and OAuth configuration are project placeholders and need to be completed before release.

## Tech stack

- Expo SDK 57, React Native, and TypeScript
- React Navigation bottom tabs
- Expo SQLite and Zustand for app state and persistence
- Expo Notifications for opt-in local reminders
- Free Exercise DB content in `assets/free-exercise-db/`

## Project layout

```text
App.tsx                         App entry and navigation
src/screens/                    Onboarding, consent, Today, Progress, Profile
src/components/                 Shared accessible controls and legal modal
src/services/                   Daily set generation, XP, authentication
src/db/                         Local database and SQL migration
src/store/                      Persisted application state
src/models/                     Profile, exercise, and daily set types
src/legal/                      Draft privacy policy and terms
src/config/                     Business and app configuration placeholders
src/data/                       Badge definitions
assets/free-exercise-db/        Exercise data and upstream attribution/license
docs/                           Data deletion and third-party asset notes
scripts/                        Exercise import utility
SECURITY.md                     Dependency and static security review notes
```

## Getting started

### Requirements

- Node.js compatible with the installed Expo SDK
- npm
- Expo Go for a quick device preview, or the relevant native development tools for a native build

### Install and run

```sh
npm install
npm run start
```

Then use the Expo CLI to open the app on a device, emulator, or web browser. Convenience commands are also available:

```sh
npm run android
npm run ios
npm run web
```

`npm run ios` requires macOS and Xcode. Native notification behavior and OAuth should be verified in the appropriate development or production build.

## Exercise data

The app includes the Free Exercise DB dataset under `assets/free-exercise-db/`. Review that directory's README and `LICENSE.md` for source, license, and attribution details. The import utility can be run with:

```sh
npm run import-exercises
```

## Security and privacy

See [SECURITY.md](SECURITY.md) for the dependency audit findings, mitigations considered, and review limits. The current review is static; it is not a penetration test or device runtime assessment. Do not put credentials in source control. Configure OAuth client IDs through the appropriate local or deployment configuration before enabling sign-in.

The privacy policy and terms under `src/legal/` are drafts, and business details in `src/config/business.ts` are placeholders. They require completion and review before distribution. The app's age and consent behavior should also be checked against the intended audience and launch jurisdictions.

## Development scripts

| Command | Purpose |
| --- | --- |
| `npm run start` | Start the Expo development server |
| `npm run android` | Start Expo for Android |
| `npm run ios` | Start Expo for iOS |
| `npm run web` | Start Expo for web |
| `npm run import-exercises` | Run the exercise data import utility |

