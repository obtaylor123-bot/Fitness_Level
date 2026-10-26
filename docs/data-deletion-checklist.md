# Manual account and data-deletion verification

Run on a production-like Android build after applying the Supabase migration and deploying the `delete-account` Edge Function.

1. Create separate Google and email accounts. For each, complete age/document acknowledgement, create a workout profile, record weights, complete a workout, and enable a local reminder.
2. In Supabase, verify `user_profiles`, `user_consents`, `daily_sets`, and `xp_transactions` contain only the expected account-owned rows.
3. Sign in as a second account. Confirm it cannot read or change the first account's rows. Also query the Data API without an access token and confirm it has no access to these tables.
4. Sign back into the first account and restart the app. Verify that the account and today's workout restore from Supabase.
5. Cancel one deletion prompt and confirm the account, cloud rows, profile, and reminder remain.
6. Confirm Delete my data. Verify the Edge Function derives the user ID from the verified token, deletes the Supabase Auth account, and foreign-key cascades remove all profile, consent, daily workout, and XP rows. Verify scheduled reminders are canceled on the device and the app returns to login.
7. Repeat deletion for Google and email accounts. Confirm function failures are surfaced and that the app does not claim deletion succeeded when the server is unavailable.

The upgrade flow offers an explicit import of personal records left in the former local SQLite database. Verify import preserves the profile and dates, and that the old local copy is removed only after all cloud writes succeed. Choosing “Start fresh” permanently erases the legacy records. Verify account deletion also removes that legacy database on an upgraded installation. The bundled exercise catalog is public app content and is stored separately.
