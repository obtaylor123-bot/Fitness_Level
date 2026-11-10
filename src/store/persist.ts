// src/store/persist.ts
//
// Hydrates the Zustand store from either:
//   - Supabase (when configured) — cloud profile + daily set
//   - Local SQLite (guest mode / no Supabase) — local profile + daily set

import { formatISO } from 'date-fns';
import { executeSql, runMigrations } from '../db/database';
import { isSupabaseConfigured } from '../services/supabase';
import { getConsentAcceptedAt, getDailySet, getUserProfile } from '../services/userData';
import { useStore } from '../store';

// ─── LOCAL (SQLite) hydration ──────────────────────────────────────────────

async function rehydrateLocal(userId: string): Promise<void> {
  const { setUser, setDailySet, setHydrated } = useStore.getState();
  setHydrated(false);
  try {
    await runMigrations();

    // Load user profile from local SQLite
    const result = await executeSql('SELECT * FROM user_profile WHERE id = ? LIMIT 1;', [userId]);
    if (result.rows.length > 0) {
      const row = result.rows.item(0);
      let equipmentAvailable: string[] = [];
      try {
        equipmentAvailable = typeof row.equipmentAvailable === 'string'
          ? JSON.parse(row.equipmentAvailable)
          : row.equipmentAvailable || [];
      } catch {
        equipmentAvailable = [];
      }
      const profile = {
        id: row.id,
        goal: row.goal,
        equipmentAvailable,
        experienceLevel: row.experienceLevel,
        currentXP: row.currentXP ?? 0,
        currentLevel: row.currentLevel ?? 1,
        currentStreak: row.currentStreak ?? 0,
        longestStreak: row.longestStreak ?? 0,
        joinDate: row.joinDate,
        notificationTime: row.notificationTime ?? '08:00',
        notificationsEnabled: Boolean(row.notificationsEnabled),
        currentWeight: row.currentWeight ? parseFloat(row.currentWeight) : undefined,
        targetWeight: row.targetWeight ? parseFloat(row.targetWeight) : undefined,
        weightUnit: (row.weightUnit as 'lbs' | 'kg') || 'lbs',
        email: row.email,
        displayName: row.displayName,
        photoUrl: row.photoUrl,
        authProvider: (row.authProvider || 'guest') as 'guest' | 'google' | 'email',
      };
      setUser(profile);

      // Load today's daily set
      const today = formatISO(new Date(), { representation: 'date' });
      const setRes = await executeSql(
        'SELECT * FROM daily_sets WHERE userId = ? AND date = ?;',
        [userId, today]
      );
      if (setRes.rows.length > 0) {
        const setRow = setRes.rows.item(0);
        let exercises = [];
        try {
          exercises = typeof setRow.exercises === 'string'
            ? JSON.parse(setRow.exercises)
            : setRow.exercises ?? [];
        } catch {
          exercises = [];
        }
        setDailySet({
          id: setRow.id,
          userId: setRow.userId,
          date: setRow.date,
          exercises,
          totalXpAvailable: setRow.totalXpAvailable ?? 0,
          totalXpEarned: setRow.totalXpEarned ?? 0,
          completedAt: setRow.completedAt,
        });
      } else {
        setDailySet(null);
      }
    } else {
      // No profile yet — OnboardingFlow will create one
      setUser(null);
      setDailySet(null);
    }
  } catch (err) {
    console.error('Could not load local account data:', err);
  } finally {
    setHydrated(true);
  }
}

// ─── SUPABASE hydration ────────────────────────────────────────────────────

async function rehydrateCloud(userId: string): Promise<void> {
  const { setUser, setDailySet, setConsentAcceptedAt, setHydrated, setLegacyImportAvailable } = useStore.getState();
  setHydrated(false);
  try {
    await runMigrations();
    setConsentAcceptedAt(await getConsentAcceptedAt(userId));
    const profile = await getUserProfile(userId);
    setUser(profile);
    if (!profile) {
      setLegacyImportAvailable(false);
    } else {
      setLegacyImportAvailable(false);
      setDailySet(await getDailySet(userId, new Date(formatISO(new Date(), { representation: 'date' }))));
    }
  } catch {
    console.error('Could not load cloud account data.');
    throw new Error('Could not load your account data.');
  } finally {
    setHydrated(true);
  }
}

// ─── PUBLIC API ────────────────────────────────────────────────────────────

export async function rehydrateStore(userId: string): Promise<void> {
  if (isSupabaseConfigured) {
    return rehydrateCloud(userId);
  }
  return rehydrateLocal(userId);
}
