// src/db/database.ts

import { Platform } from 'react-native';

export interface SQLResultSetRowList {
  length: number;
  item: (index: number) => any;
  _array: any[];
}

export interface SQLResultSet {
  insertId?: number;
  rowsAffected: number;
  rows: SQLResultSetRowList;
}

// ----------------------------------------------------
// NATIVE SQLITE DRIVER (iOS / Android)
// ----------------------------------------------------
let nativeDbInstance: any = null;

const getNativeDb = () => {
  if (!nativeDbInstance) {
    const SQLite = require('expo-sqlite');
    nativeDbInstance = SQLite.openDatabaseSync('fitness_level.db');
  }
  return nativeDbInstance;
};

const executeNativeSql = async (
  sql: string,
  params: any[] = []
): Promise<SQLResultSet> => {
  const db = getNativeDb();
  const trimmed = sql.trim().toUpperCase();

  if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA')) {
    const allRows = await db.getAllAsync(sql, params);
    return {
      rowsAffected: 0,
      rows: {
        length: allRows.length,
        item: (index: number) => allRows[index],
        _array: allRows,
      },
    };
  }

  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (statements.length > 1) {
    await db.execAsync(sql);
    return {
      rowsAffected: 0,
      rows: { length: 0, item: () => null, _array: [] },
    };
  }

  const res = await db.runAsync(sql, params);
  return {
    insertId: res.lastInsertRowId,
    rowsAffected: res.changes,
    rows: {
      length: 0,
      item: () => null,
      _array: [],
    },
  };
};

// ----------------------------------------------------
// WEB STORAGE DRIVER (Fallback for Browser without SharedArrayBuffer)
// ----------------------------------------------------
const WEB_KEYS = {
  USER_PROFILE: 'fitness_level_user_profile',
  DAILY_SETS: 'fitness_level_daily_sets',
  XP_TRANSACTIONS: 'fitness_level_xp_transactions',
  CONSENT: 'fitness_level_consent',
};

let webExercisesCache: any[] | null = null;
let webLevelsCache: { level: number; requiredXp: number }[] | null = null;

const getWebExercises = (): any[] => {
  if (!webExercisesCache) {
    try {
      const raw = require('../../assets/free-exercise-db/dist/exercises.json');
      webExercisesCache = raw.map((ex: any) => {
        const levelFactor =
          ex.level === 'expert' ? 3 : ex.level === 'intermediate' ? 2 : 1;
        return {
          id: ex.id,
          name: ex.name,
          category: ex.category || 'strength',
          equipment: Array.isArray(ex.equipment)
            ? ex.equipment.join(', ')
            : ex.equipment || 'bodyweight',
          primaryMuscles: Array.isArray(ex.primaryMuscles)
            ? ex.primaryMuscles.join(', ')
            : ex.primaryMuscles || '',
          secondaryMuscles: Array.isArray(ex.secondaryMuscles)
            ? ex.secondaryMuscles.join(', ')
            : ex.secondaryMuscles || '',
          level: ex.level || 'beginner',
          defaultXP: 10 * levelFactor,
          defaultSets: ex.category === 'cardio' ? 1 : 3,
          defaultReps: ex.category === 'cardio' ? 0 : 12,
          defaultDurationSec: ex.category === 'cardio' ? 180 : 0,
        };
      });
    } catch {
      webExercisesCache = [];
    }
  }
  return webExercisesCache ?? [];
};

const getWebLevels = () => {
  if (!webLevelsCache) {
    webLevelsCache = [];
    for (let lvl = 1; lvl <= 100; lvl++) {
      webLevelsCache.push({
        level: lvl,
        requiredXp: Math.floor(100 * Math.pow(lvl, 1.5)),
      });
    }
  }
  return webLevelsCache;
};

const getWebStorageItem = <T>(key: string, defaultValue: T): T => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(key);
      return val ? JSON.parse(val) : defaultValue;
    }
  } catch {
    // ignore
  }
  return defaultValue;
};

const setWebStorageItem = (key: string, value: any): void => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // ignore
  }
};

const executeWebSql = async (
  sql: string,
  params: any[] = []
): Promise<SQLResultSet> => {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  const upper = normalized.toUpperCase();

  // Helper for returning rows
  const toResult = (rows: any[]): SQLResultSet => ({
    rowsAffected: 0,
    rows: {
      length: rows.length,
      item: (i: number) => rows[i],
      _array: rows,
    },
  });

  // 1. user_profile queries
  if (upper.includes('FROM USER_PROFILE')) {
    const profile = getWebStorageItem<any | null>(WEB_KEYS.USER_PROFILE, null);
    if (!profile) return toResult([]);

    if (upper.includes('WHERE ID = ?')) {
      const match = profile.id === params[0];
      return toResult(match ? [profile] : []);
    }
    return toResult([profile]);
  }

  if (upper.startsWith('INSERT INTO USER_PROFILE') || upper.startsWith('INSERT OR REPLACE INTO USER_PROFILE')) {
    const profile = {
      id: params[0],
      goal: params[1],
      equipmentAvailable: params[2],
      experienceLevel: params[3],
      currentXP: params[4],
      currentLevel: params[5],
      currentStreak: params[6],
      longestStreak: params[7],
      joinDate: params[8],
      notificationTime: params[9],
      email: params[10] ?? null,
      displayName: params[11] ?? null,
      photoUrl: params[12] ?? null,
      authProvider: params[13] ?? 'guest',
      notificationsEnabled: params[14] ?? 0,
    };
    setWebStorageItem(WEB_KEYS.USER_PROFILE, profile);
    return { rowsAffected: 1, rows: { length: 0, item: () => null, _array: [] } };
  }

  if (upper.startsWith('UPDATE USER_PROFILE')) {
    const profile = getWebStorageItem<any | null>(WEB_KEYS.USER_PROFILE, null);
    if (profile) {
      const setMatch = normalized.match(/SET\s+(.+?)\s+WHERE/i);
      if (setMatch) {
        const assignments = setMatch[1].split(',').map((s) => s.trim().split('=')[0].trim());
        assignments.forEach((col, idx) => {
          if (idx < params.length) {
            profile[col] = params[idx];
          }
        });
      }
      setWebStorageItem(WEB_KEYS.USER_PROFILE, profile);
    }
    return { rowsAffected: 1, rows: { length: 0, item: () => null, _array: [] } };
  }

  // 2. daily_sets queries
  if (upper.includes('FROM DAILY_SETS')) {
    let sets = getWebStorageItem<any[]>(WEB_KEYS.DAILY_SETS, []);
    if (upper.includes('WHERE USERID = ? AND DATE = ?')) {
      const found = sets.find((s) => s.userId === params[0] && s.date === params[1]);
      return toResult(found ? [found] : []);
    }
    if (upper.includes('WHERE USERID = ? AND DATE IN')) {
      const dates = params.slice(1);
      const filtered = sets.filter((s) => s.userId === params[0] && dates.includes(s.date));
      return toResult(filtered);
    }
    if (upper.includes('WHERE USERID = ?')) {
      sets = sets.filter((s) => s.userId === params[0]);
      sets = sets.sort((a: any, b: any) => (b.date > a.date ? 1 : -1));
      const limitMatch = upper.match(/LIMIT (\d+)/);
      if (limitMatch) sets = sets.slice(0, parseInt(limitMatch[1], 10));
      return toResult(sets);
    }
    return toResult(sets);
  }

  if (upper.startsWith('INSERT INTO DAILY_SETS')) {
    const sets = getWebStorageItem<any[]>(WEB_KEYS.DAILY_SETS, []);
    const newSet = {
      id: params[0],
      userId: params[1],
      date: params[2],
      exercises: params[3],
      totalXpAvailable: params[4],
      totalXpEarned: params[5],
    };
    sets.push(newSet);
    setWebStorageItem(WEB_KEYS.DAILY_SETS, sets);
    return { rowsAffected: 1, rows: { length: 0, item: () => null, _array: [] } };
  }

  if (upper.startsWith('UPDATE DAILY_SETS')) {
    const sets = getWebStorageItem<any[]>(WEB_KEYS.DAILY_SETS, []);
    const idx = sets.findIndex((s) => s.id === params[2]);
    if (idx !== -1) {
      sets[idx].exercises = params[0];
      sets[idx].totalXpEarned = params[1];
      setWebStorageItem(WEB_KEYS.DAILY_SETS, sets);
    }
    return { rowsAffected: 1, rows: { length: 0, item: () => null, _array: [] } };
  }

  // 3. exercises queries
  if (upper.includes('FROM EXERCISES')) {
    const allEx = getWebExercises();
    if (upper.includes('WHERE ID = ?')) {
      const found = allEx.find((e) => e.id === params[0]);
      return toResult(found ? [found] : []);
    }
    // Filter candidates by category and equipment
    let results = allEx;
    if (params.length > 0) {
      const eqPatterns = params
        .filter((p) => typeof p === 'string' && p.startsWith('%'))
        .map((p) => p.replace(/%/g, '').toLowerCase().trim());

      if (eqPatterns.length > 0) {
        results = results.filter((e) => {
          const exEq = (e.equipment || 'body only').toLowerCase();
          return eqPatterns.some((pat) => exEq.includes(pat));
        });
      }

      const categories = params.filter((p) => typeof p === 'string' && !p.startsWith('%'));
      if (categories.length > 0) {
        const catSet = new Set(categories.map((c) => c.toLowerCase()));
        const catFiltered = results.filter((e) => catSet.has((e.category || '').toLowerCase()));
        if (catFiltered.length > 0) {
          results = catFiltered;
        }
      }
    }
    return toResult(results);
  }

  // 4. levels queries
  if (upper.includes('FROM LEVELS')) {
    const levels = getWebLevels();
    if (upper.includes('WHERE LEVEL = ?')) {
      const found = levels.find((l) => l.level === params[0]);
      return toResult(found ? [found] : []);
    }
    if (upper.includes('WHERE REQUIREDXP <=')) {
      const xp = params[0];
      const eligible = levels
        .filter((l) => l.requiredXp <= xp)
        .sort((a, b) => b.level - a.level);
      return toResult(eligible.slice(0, 1));
    }
    return toResult(levels);
  }

  // 5. xp_transactions queries
  if (upper.includes('FROM XP_TRANSACTIONS')) {
    let txs = getWebStorageItem<any[]>(WEB_KEYS.XP_TRANSACTIONS, []);
    if (upper.includes('WHERE USERID = ?')) {
      txs = txs.filter((t) => t.userId === params[0]);
      txs = txs.sort((a: any, b: any) => (b.date > a.date ? 1 : -1));
      const limitMatch = upper.match(/LIMIT (\d+)/);
      if (limitMatch) txs = txs.slice(0, parseInt(limitMatch[1], 10));
    }
    return toResult(txs);
  }

  if (upper.startsWith('INSERT INTO XP_TRANSACTIONS')) {
    const txs = getWebStorageItem<any[]>(WEB_KEYS.XP_TRANSACTIONS, []);
    txs.push({
      id: params[0],
      userId: params[1],
      date: params[2],
      amount: params[3],
      source: params[4],
    });
    setWebStorageItem(WEB_KEYS.XP_TRANSACTIONS, txs);
    return { rowsAffected: 1, rows: { length: 0, item: () => null, _array: [] } };
  }

  // Fallback for DDL / table creation
  return { rowsAffected: 0, rows: { length: 0, item: () => null, _array: [] } };
};

// ----------------------------------------------------
// PUBLIC API
// ----------------------------------------------------
export const executeSql = async (
  sql: string,
  params: any[] = []
): Promise<SQLResultSet> => {
  if (Platform.OS === 'web') {
    return executeWebSql(sql, params);
  }
  return executeNativeSql(sql, params);
};

export async function getConsentAcceptedAt(): Promise<string | null> {
  if (Platform.OS === 'web') {
    const consent = getWebStorageItem<{ accepted: boolean; acceptedAt: string } | null>(WEB_KEYS.CONSENT, null);
    return consent?.accepted ? consent.acceptedAt : null;
  }
  const db = getNativeDb();
  await db.execAsync('CREATE TABLE IF NOT EXISTS app_consent (accepted INTEGER NOT NULL, acceptedAt TEXT NOT NULL);');
  const row = await db.getFirstAsync('SELECT accepted, acceptedAt FROM app_consent LIMIT 1;');
  return row?.accepted === 1 ? row.acceptedAt : null;
}

export async function saveConsentAcceptedAt(acceptedAt: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !window.localStorage) {
      throw new Error('Browser localStorage is unavailable');
    }
    window.localStorage.setItem(WEB_KEYS.CONSENT, JSON.stringify({ accepted: true, acceptedAt }));
    return;
  }
  const db = getNativeDb();
  await db.execAsync('CREATE TABLE IF NOT EXISTS app_consent (accepted INTEGER NOT NULL, acceptedAt TEXT NOT NULL);');
  await db.runAsync('DELETE FROM app_consent;');
  await db.runAsync('INSERT INTO app_consent (accepted, acceptedAt) VALUES (1, ?);', [acceptedAt]);
}

/** Removes user-generated records and consent. Exercise/level catalogs are public app data. */
export async function deleteAllUserData(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !window.localStorage) {
      throw new Error('Browser localStorage is unavailable');
    }
    for (const key of Object.values(WEB_KEYS)) window.localStorage.removeItem(key);
    return;
  }
  const db = getNativeDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM daily_sets;');
    await db.runAsync('DELETE FROM xp_transactions;');
    await db.runAsync('DELETE FROM user_profile;');
    await db.runAsync('DELETE FROM app_consent;');
  });
}

export const runMigrations = async (): Promise<void> => {
  if (Platform.OS === 'web') {
    // Warm up web caches
    getWebExercises();
    getWebLevels();
    return;
  }

  // Native migrations
  const db = getNativeDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      equipment TEXT,
      primaryMuscles TEXT,
      secondaryMuscles TEXT,
      level TEXT,
      instructions TEXT,
      imageUrls TEXT,
      defaultXP INTEGER,
      defaultSets INTEGER,
      defaultReps INTEGER,
      defaultDurationSec INTEGER
    );

    CREATE TABLE IF NOT EXISTS daily_sets (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      date TEXT NOT NULL,
      exercises TEXT NOT NULL,
      totalXpAvailable INTEGER,
      totalXpEarned INTEGER,
      completedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS user_profile (
      id TEXT PRIMARY KEY,
      goal TEXT,
      equipmentAvailable TEXT,
      experienceLevel TEXT,
      currentXP INTEGER,
      currentLevel INTEGER,
      currentStreak INTEGER,
      longestStreak INTEGER,
      joinDate TEXT,
      notificationTime TEXT,
      currentWeight REAL,
      targetWeight REAL,
      weightUnit TEXT,
      email TEXT,
      displayName TEXT,
      photoUrl TEXT,
      authProvider TEXT,
      notificationsEnabled INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_consent (
      accepted INTEGER NOT NULL,
      acceptedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS xp_transactions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      date TEXT NOT NULL,
      amount INTEGER NOT NULL,
      source TEXT
    );

    CREATE TABLE IF NOT EXISTS levels (
      level INTEGER PRIMARY KEY,
      requiredXp INTEGER NOT NULL
    );
  `);

  // Migrate existing databases to include new columns
  try { await db.execAsync('ALTER TABLE user_profile ADD COLUMN currentWeight REAL;'); } catch {}
  try { await db.execAsync('ALTER TABLE user_profile ADD COLUMN targetWeight REAL;'); } catch {}
  try { await db.execAsync('ALTER TABLE user_profile ADD COLUMN weightUnit TEXT;'); } catch {}
  try { await db.execAsync('ALTER TABLE user_profile ADD COLUMN email TEXT;'); } catch {}
  try { await db.execAsync('ALTER TABLE user_profile ADD COLUMN displayName TEXT;'); } catch {}
  try { await db.execAsync('ALTER TABLE user_profile ADD COLUMN photoUrl TEXT;'); } catch {}
  try { await db.execAsync('ALTER TABLE user_profile ADD COLUMN authProvider TEXT;'); } catch {}
  try { await db.execAsync('ALTER TABLE user_profile ADD COLUMN notificationsEnabled INTEGER NOT NULL DEFAULT 0;'); } catch {}

  const levelsCount: any = await db.getFirstAsync(
    'SELECT count(*) as count FROM levels;'
  );
  if (!levelsCount || levelsCount.count === 0) {
    for (let lvl = 1; lvl <= 100; lvl++) {
      const xp = Math.floor(100 * Math.pow(lvl, 1.5));
      await db.runAsync(
        'INSERT OR REPLACE INTO levels (level, requiredXp) VALUES (?, ?);',
        [lvl, xp]
      );
    }
  }

  const exercisesCount: any = await db.getFirstAsync(
    'SELECT count(*) as count FROM exercises;'
  );
  if (!exercisesCount || exercisesCount.count === 0) {
    try {
      const exercisesData = require('../../assets/free-exercise-db/dist/exercises.json');
      if (Array.isArray(exercisesData) && exercisesData.length > 0) {
        for (const raw of exercisesData) {
          const levelFactor =
            raw.level === 'expert' ? 3 : raw.level === 'intermediate' ? 2 : 1;
          const defaultXP = 10 * levelFactor;
          const defaultSets = raw.category === 'cardio' ? 1 : 3;
          const defaultReps = raw.category === 'cardio' ? 0 : 12;
          const defaultDurationSec = raw.category === 'cardio' ? 180 : 0;
          const equipment = Array.isArray(raw.equipment)
            ? raw.equipment.join(', ')
            : raw.equipment || 'bodyweight';
          const primaryMuscles = Array.isArray(raw.primaryMuscles)
            ? raw.primaryMuscles.join(', ')
            : raw.primaryMuscles || '';
          const secondaryMuscles = Array.isArray(raw.secondaryMuscles)
            ? raw.secondaryMuscles.join(', ')
            : raw.secondaryMuscles || '';

          await db.runAsync(
            `INSERT OR REPLACE INTO exercises (id, name, category, equipment, primaryMuscles, secondaryMuscles, level, defaultXP, defaultSets, defaultReps, defaultDurationSec)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              raw.id,
              raw.name,
              raw.category || 'strength',
              equipment,
              primaryMuscles,
              secondaryMuscles,
              raw.level || 'beginner',
              defaultXP,
              defaultSets,
              defaultReps,
              defaultDurationSec,
            ]
          );
        }
      }
    } catch (e) {
      console.warn('Could not auto-seed exercises.json:', e);
    }
  }
};

const db = {
  executeSql,
  runMigrations,
};

export default db;
