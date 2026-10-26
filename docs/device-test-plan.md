# Android device verification plan

Run these checks on a development build and a release-like build with a configured Supabase test project. Record Android version, device, app version, account type, result, and issue link for each item. A passing TypeScript or export check is not a device pass.

| Area | Steps | Expected result |
| --- | --- | --- |
| TalkBack | Enable TalkBack; move through login, consent, onboarding, workout, progress, profile, reminders, and delete confirmation. | Controls announce meaningful labels, role, state, and hints; focus order follows the screen; no essential meaning relies on color alone. |
| External keyboard | Connect a keyboard; Tab/Shift+Tab through forms and controls; activate with Enter/Space. | Every action is reachable and visibly focused; focus stays inside a modal until dismissed. |
| Text scaling | Set Android font/display size to the largest supported value and reopen the screens. | Text remains readable; buttons and dialogs grow or scroll; no clipped actions or overlapping fields. |
| Network loss during sync | Start a workout completion or profile update, disable network before it finishes, then restore network. | Clear retry feedback; no false success; no duplicate XP/workout transaction after retry. |
| Airplane mode | Launch offline, inspect catalog and account state; attempt sync/sign-in. | Public exercise catalog remains usable where supported; cloud features report offline status and never fake a successful sign-in or save. |
| Storage loss / app data cleared | Clear app storage while a test account exists, then relaunch and sign back in. | Cloud profile/workouts restore; session asks for sign-in; no other user's data appears. |
| Token refresh and expiry | Leave a test account idle past token refresh; force sign-out/expiry through Supabase test settings and retry. | Valid refresh restores the session; invalid/expired tokens return to login without exposing tokens in logs. |
| Account deletion | Delete a disposable account online; repeat with network disabled and with the function returning an error. | Success deletes cloud user, then local legacy data, cancels reminders, and clears the session. Cloud failure leaves local data/session intact and allows retry. Partial local cleanup is marked and retried at next app start. |
| Reinstall | Install after deletion; sign in with the deleted account, then with a distinct account. | Deleted account cannot authenticate; no previous local personal data or reminder remains; second account starts clean. |
| Upgrade over previous version | Install a previous local-only build with sample profile/workouts, upgrade in place, and test import and “Start fresh.” | Import preserves dates/weights/history before clearing old SQLite; “Start fresh” erases old data; neither path loses data before successful cloud writes. |
| Local reminders | Grant notification permission, schedule/change/cancel a reminder, reboot device, and test delivery. | Reminder is local, honors selected time, survives reboot, can be canceled, and permission denial is handled without crashing. |
| OAuth redirects | Exercise Google and email confirmation from the release-like build. | Supabase returns to `fitnesslevel://auth/callback`; no OAuth secret is present in the app or logs. |
| Guest account | Continue as guest, create profile/workouts, restart the app, then test sign-out warning, app-data clearing, reinstall, and deletion. | Guest session and cloud data persist while the device session remains; warning explains logout/data clearing/reinstall makes it inaccessible; Delete my data removes the anonymous Auth user and associated records. |
