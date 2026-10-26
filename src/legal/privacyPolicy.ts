// DRAFT - business identity, hosted policy URL, and legal review remain required.
import { BUSINESS_DETAILS } from '../config/business';

export const PRIVACY_POLICY_UPDATED = 'October 26, 2026';

export const PRIVACY_POLICY = `Privacy Policy
Last updated: ${PRIVACY_POLICY_UPDATED}

${BUSINESS_DETAILS.name} provides Fitness Level, a workout tracking app.

Information the app stores
The app stores a profile identifier, fitness goal, selected equipment, experience level, XP, level progress, streaks, join date, and reminder settings. Workout sets and completion history are stored with your account. Current weight and goal weight are optional. The app also stores when you accepted the age and document acknowledgement. If you use Google sign-in, Google and Supabase Auth process the sign-in request. The app stores the account email, display name, and profile photo URL returned for your signed-in profile. Email/password sign-in is also provided through Supabase Auth.

Where information is stored and sent
Account, profile, workout, optional weight, and consent records are sent to and stored in the app owner's Supabase project. Supabase processes authentication and database requests for the app. The Supabase project owner and its authorized administrators can access that project data. On Android, the app stores the authentication session in Android's secure credential storage. If a web build is used, its authentication session is stored in browser localStorage. The app does not use cookies or web analytics. The app's public exercise catalog is bundled with the app and cached in local SQLite on Android.

Google sign-in
If you choose Google sign-in, the app opens Google's authentication flow through Supabase Auth and requests basic profile and email access. Google and Supabase process authentication information under their respective policies. The app then stores the resulting account profile fields and workout information in Supabase. Sign-in does not itself upload contacts or workout information to Google.

Notifications
If you enable a workout reminder, Android schedules a local notification at the time you choose. Reminder scheduling remains on your device.

Your choices and deletion
Weight tracking is optional. Leave the weight fields blank or use “Turn off and clear weight tracking” to remove saved weights. If this device has local data from an older version, you can import it into your signed-in account or choose to erase it before continuing. Use “Delete my data” in Profile to request deletion of your Supabase authentication account and its associated profile, workout, XP, weight, and consent records. This also cancels scheduled app reminders on the current device and clears the old local database. Account deletion requires an internet connection.

Contact
Business: ${BUSINESS_DETAILS.name}
Support: ${BUSINESS_DETAILS.supportEmail}
Address: ${BUSINESS_DETAILS.physicalAddress}
Website: ${BUSINESS_DETAILS.website}`;
