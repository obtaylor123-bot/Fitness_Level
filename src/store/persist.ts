// src/store/persist.ts
//
// Hydrates the Zustand store from either:
//   - Local Guest Storage (when guest user) — no SQLite queries, no network!
//   - Supabase (when signed in to Supabase) — cloud profile + daily set

import { formatISO } from 'date-fns';
import { runMigrations } from '../db/database';
import { isSupabaseConfigured } from '../services/supabase';
import { getConsentAcceptedAt, getDailySet, getUserProfile } from '../services/userData';
import { getSavedGuestProfile, isGuestId } from '../utils/guestSession';
import { useStore } from '../store';

async function rehydrateGuest(userId: string): Promise<void> {
  const { setUser, setDailySet, setConsentAcceptedAt, setHydrated } = useStore.getState();
  setHydrated(false);
  try {
    // Ensure catalog tables (exercises, levels) exist
    await runMigrations().catch(() => {});

    const profile = await getSavedGuestProfile();
    setUser(profile);
    setConsentAcceptedAt(new Date().toISOString());

    if (profile) {
      const todaySet = await getDailySet(userId, new Date());
      setDailySet(todaySet);
    } else {
      setDailySet(null);
    }
  } catch (err) {
    console.warn('rehydrateGuest warning:', err);
  } finally {
    setHydrated(true);
  }
}

async function rehydrateCloud(userId: string): Promise<void> {
  const { setUser, setDailySet, setConsentAcceptedAt, setHydrated, setLegacyImportAvailable } = useStore.getState();
  setHydrated(false);
  try {
    await runMigrations().catch(() => {});
    setConsentAcceptedAt(await getConsentAcceptedAt(userId));
    const profile = await getUserProfile(userId);
    setUser(profile);
    setLegacyImportAvailable(false);
    if (profile) {
      setDailySet(await getDailySet(userId, new Date(formatISO(new Date(), { representation: 'date' }))));
    } else {
      setDailySet(null);
    }
  } catch {
    console.error('Could not load cloud account data.');
  } finally {
    setHydrated(true);
  }
}

export async function rehydrateStore(userId: string): Promise<void> {
  if (isGuestId(userId) || !isSupabaseConfigured) {
    return rehydrateGuest(userId);
  }
  return rehydrateCloud(userId);
}
