# Manual data-deletion verification

Run this checklist on a native build and in a web browser before release.

1. Create a profile, enter current and goal weights, complete a workout, sign in to Google if configured, and enable a local reminder.
2. Open Profile > Delete my data. Confirm the dialog names the profile, workout/XP history, weight entries, reminder and scheduled notification, stored Google profile fields, consent record, and that deletion cannot be undone.
3. Cancel once and verify the profile is still available.
4. Confirm deletion. Verify the app returns to the age and consent first-run screen.
5. On native, inspect SQLite: `user_profile`, `daily_sets`, `xp_transactions`, and `app_consent` must have no rows. Verify there are no scheduled Fitness Level notifications. The public `exercises` and `levels` lookup tables are app content and may remain or be reseeded on next launch.
6. On web, inspect localStorage and verify these keys are absent: `fitness_level_user_profile`, `fitness_level_daily_sets`, `fitness_level_xp_transactions`, and `fitness_level_consent`.
7. Restart the app. Verify the consent screen appears and no profile, weights, workout history, Google profile, or reminder is restored.

No secure-store or persistent OAuth token storage is implemented in this app. Google sign-in receives an access token for the user-info request and does not persist it.
