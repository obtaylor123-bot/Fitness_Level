import { formatISO } from 'date-fns';
import { readLegacyLocalUserData, runMigrations } from '../db/database';
import { getConsentAcceptedAt, getDailySet, getUserProfile } from '../services/userData';
import { useStore } from '../store';

/** Loads the signed-in user's private profile and current workout from Supabase. */
export async function rehydrateStore(userId: string): Promise<void> {
  const { setUser, setDailySet, setConsentAcceptedAt, setHydrated, setLegacyImportAvailable } = useStore.getState();
  setHydrated(false);
  try {
    // This local database contains only the bundled public exercise/level catalog.
    await runMigrations();
    setConsentAcceptedAt(await getConsentAcceptedAt(userId));
    const profile = await getUserProfile(userId);
    setUser(profile);
    if (!profile) {
      const legacy = await readLegacyLocalUserData();
      setLegacyImportAvailable(Boolean(legacy.profile));
    } else {
      setLegacyImportAvailable(false);
    }
    if (profile) {
      setDailySet(await getDailySet(userId, new Date(formatISO(new Date(), { representation: 'date' }))));
    } else {
      setDailySet(null);
    }
  } catch {
    console.error('Could not load your account data.');
    throw new Error('Could not load your account data.');
  } finally {
    setHydrated(true);
  }
}
