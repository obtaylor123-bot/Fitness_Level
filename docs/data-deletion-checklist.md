# Manual account and data-deletion verification

Run on a production-like Android build after applying the Supabase migration and deploying the `delete-account` Edge Function. Google Play also requires a working web resource where a user can request account and associated-data deletion without reinstalling the app; `web/account-deletion.html` is only a draft until the contact details are replaced, the request mailbox/process is staffed, and the page is hosted.

1. Create separate guest, Google, and email accounts. Acknowledge the documents, create a workout profile, record weights, complete a workout, and enable a local reminder for each account.
2. In Supabase, verify `user_profiles`, `user_consents`, `daily_sets`, and `xp_transactions` contain only the expected account-owned rows.
3. Run the repeatable two-account isolation script against a disposable local Supabase project. It checks cross-user reads/inserts/updates/deletes plus unauthenticated reads for every table:

   ```sh
   supabase start
   # Set SUPABASE_URL, SUPABASE_ANON_KEY, RLS_TEST_USER_A_EMAIL/PASSWORD,
   # and RLS_TEST_USER_B_EMAIL/PASSWORD using two local disposable accounts.
   node scripts/test-rls.mjs
   ```

   It creates temporary fixtures as user B and removes them at the end. Use clean test accounts; it does not delete the accounts. Repeat the checks against the production project only with owner approval and dedicated accounts. Never use a service-role key for this script.
4. Sign back into the first account and restart the app. Verify that the account and today's workout restore from Supabase.
5. Cancel one deletion prompt and confirm the account, cloud rows, profile, and reminder remain.
6. Confirm Delete my data online. Verify the Edge Function verifies the JWT with `auth.getUser()`, derives the ID from the verified user, ignores the request body, deletes the Auth account, and foreign-key cascades remove all profile, consent, daily workout, and XP rows. Then confirm local legacy data is erased, reminders are canceled, and the local SecureStore session is cleared.
7. Repeat with airplane mode and with a failing Edge Function response. Confirm cloud failure leaves local data, reminders, and session intact and the user can retry. Simulate local cleanup failure after cloud success; verify the app signs out, reports the device cleanup state, and retries it at next launch using the SecureStore recovery marker.
8. Repeat deletion for Google and email accounts. Confirm the web request page can be used after uninstall and that the support workflow verifies the account and completes deletion.
9. Test guest sign-in and deletion. Confirm the guest account creates a Supabase Auth user, its rows remain isolated by RLS, and deleting it removes the anonymous Auth user and associated data. Confirm the warning before guest sign-out explains that the account cannot currently be recovered.

The upgrade flow offers an explicit import of personal records left in the former local SQLite database. Verify import preserves the profile and dates, and that the old local copy is removed only after all cloud writes succeed. Choosing “Start fresh” permanently erases the legacy records. Verify account deletion also removes that legacy database on an upgraded installation. The bundled exercise catalog is public app content and is stored separately.
