# Google Play Data Safety — draft

Draft answers below are inferred from current app code and require owner/legal review. Confirm the actual Supabase project region, provider settings, and every final AAB disclosure before submitting.

## Data collected

| Category | Data in this app | Purpose | Collected/shared |
| --- | --- | --- | --- |
| Personal info | Email, display name, profile photo URL (when Google provides them), account identifier, age/document acknowledgement | Account management, sign-in, saved profile | Sent to Supabase; Google processes sign-in only when selected |
| Health and fitness | Fitness goal, equipment, experience level, workout sets/history, completions, XP, level/streak metrics, optional current and target weight | App functionality and progress display | Sent to Supabase and stored in the app owner's project |
| App activity | Workout selections and completion records | App functionality and progress | Sent to Supabase |
| Device/app data | Local reminder time and enabled state | Schedule the user-requested local notification | Stored in the Supabase profile; scheduled reminder stays on device |

No advertising, analytics, or crash-reporting SDK is configured. No contacts, precise location, photos, or payment data are requested. The exercise catalog is public bundled content.

## Processing, encryption, deletion, retention

- Supabase is the database and authentication processor. Google is used as an authentication provider only if the user chooses Google sign-in. Workout, profile, and weight records are not sent to Google by the app.
- Supabase and Google requests use HTTPS/TLS. Android sign-in sessions use Expo SecureStore; SecureStore's Android backup rules exclude its `SecureStore` shared preferences from cloud backup and device transfer.
- Account deletion is offered in-app. A web request link is required by Google Play for account-creating apps; the draft page is `web/account-deletion.html` and is not yet hosted or functional until its placeholders and request handling are completed.
- Active account records are intended to remain until the user requests deletion. Configure and disclose Supabase backup retention and deletion timing before launch; these project settings have not been inspected.
- Consent age is self-attested (13+ in current code) and is not independently verified.

## Android permission inventory from generated module manifests

This is a source-level inventory from the generated app manifest and installed Expo module manifests. It is not a final merged release-manifest inspection.

| Permission | Why it is present |
| --- | --- |
| `android.permission.INTERNET` | HTTPS requests to Supabase Auth and Postgres APIs, and the Google sign-in browser flow. |
| `android.permission.POST_NOTIFICATIONS` | User may opt into local workout reminders (Android 13+ runtime permission). |
| `android.permission.RECEIVE_BOOT_COMPLETED` | Expo Notifications restores scheduled local reminders after device restart. |
| `android.permission.VIBRATE` | Android notification alert behavior. |

`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, and `SYSTEM_ALERT_WINDOW` are explicitly removed by app config. No exact-alarm or foreground-service permission is configured. Verify the final merged manifest from the production AAB with `bundletool dump manifest --bundle app-release.aab`.

## Owner review before submission

- Verify every answer against the deployed project and Play Console's current form.
- Set the Supabase region, backups, retention, dashboard admin access, and processor/DPA review.
- Publish a valid privacy policy and the working account-deletion request page; enter both URLs in Play Console.
- Confirm the age/audience decision and whether the product is within Google Play Families scope.
