// src/store/persist.ts

import { executeSql, getConsentAcceptedAt, runMigrations } from '../db/database';
import { formatISO } from 'date-fns';
import { useStore } from '../store';

/**
 * Load persisted user profile and today's daily set from SQLite
 * and hydrate the Zustand store. Called once on app launch.
 */
export async function rehydrateStore(): Promise<void> {
  const { setUser, setDailySet, setConsentAcceptedAt, setHydrated } = useStore.getState();

  try {
    // Ensure migrations have executed
    await runMigrations();
    setConsentAcceptedAt(await getConsentAcceptedAt());

    // Load user profile (first row)
    const userRes = await executeSql('SELECT * FROM user_profile LIMIT 1;');
    if (userRes.rows.length) {
      const row = userRes.rows.item(0);
      let equipmentAvailable: string[] = [];
      try {
        equipmentAvailable = typeof row.equipmentAvailable === 'string'
          ? JSON.parse(row.equipmentAvailable)
          : row.equipmentAvailable || [];
      } catch {
        equipmentAvailable = [];
      }

      const loadedUser = {
        id: row.id,
        goal: row.goal,
        equipmentAvailable,
        experienceLevel: row.experienceLevel,
        currentXP: row.currentXP,
        currentLevel: row.currentLevel,
        currentStreak: row.currentStreak,
        longestStreak: row.longestStreak,
        joinDate: row.joinDate,
        notificationTime: row.notificationTime,
        notificationsEnabled: Boolean(row.notificationsEnabled),
        currentWeight: row.currentWeight ? parseFloat(row.currentWeight) : undefined,
        targetWeight: row.targetWeight ? parseFloat(row.targetWeight) : undefined,
        weightUnit: (row.weightUnit as 'lbs' | 'kg') || 'lbs',
        email: row.email,
        displayName: row.displayName,
        photoUrl: row.photoUrl,
        authProvider: row.authProvider || 'guest',
      };
      setUser(loadedUser);

      // Load today's daily set, if it exists
      const today = formatISO(new Date(), { representation: 'date' });
      const setRes = await executeSql(
        'SELECT * FROM daily_sets WHERE userId = ? AND date = ?;',
        [loadedUser.id, today]
      );
      if (setRes.rows.length) {
        const setRow = setRes.rows.item(0);
        const loadedSet = {
          id: setRow.id,
          userId: setRow.userId,
          date: setRow.date,
          exercises: JSON.parse(setRow.exercises),
          totalXpAvailable: setRow.totalXpAvailable,
          totalXpEarned: setRow.totalXpEarned,
        };
        setDailySet(loadedSet);
      }
    }
  } catch (error) {
    console.error('Failed to rehydrate store from SQLite:', error);
  } finally {
    setHydrated(true);
  }
}
