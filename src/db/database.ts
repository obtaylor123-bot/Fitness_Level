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

let nativeDb: any;
let webExercises: any[] | null = null;
let webLevels: { level: number; requiredXp: number }[] | null = null;

function getNativeDb(): any {
  if (!nativeDb) {
    const SQLite = require('expo-sqlite');
    nativeDb = SQLite.openDatabaseSync('fitness_level_catalog.db');
  }
  return nativeDb;
}

function normalizeExercise(raw: any) {
  const levelFactor = raw.level === 'expert' ? 3 : raw.level === 'intermediate' ? 2 : 1;
  return {
    id: String(raw.id),
    name: String(raw.name),
    category: raw.category || 'strength',
    equipment: Array.isArray(raw.equipment) ? raw.equipment.join(', ') : raw.equipment || 'bodyweight',
    primaryMuscles: Array.isArray(raw.primaryMuscles) ? raw.primaryMuscles.join(', ') : raw.primaryMuscles || '',
    secondaryMuscles: Array.isArray(raw.secondaryMuscles) ? raw.secondaryMuscles.join(', ') : raw.secondaryMuscles || '',
    level: raw.level || 'beginner',
    defaultXP: 10 * levelFactor,
    defaultSets: raw.category === 'cardio' ? 1 : 3,
    defaultReps: raw.category === 'cardio' ? 0 : 12,
    defaultDurationSec: raw.category === 'cardio' ? 180 : 0,
  };
}

function getWebExercises(): any[] {
  if (!webExercises) {
    const rows = require('../../assets/free-exercise-db/dist/exercises.json');
    if (!Array.isArray(rows)) throw new Error('The bundled exercise catalog is invalid.');
    webExercises = rows.map(normalizeExercise);
  }
  return webExercises;
}

function getWebLevels() {
  if (!webLevels) {
    webLevels = Array.from({ length: 100 }, (_, index) => {
      const level = index + 1;
      return { level, requiredXp: Math.floor(100 * Math.pow(level, 1.5)) };
    });
  }
  return webLevels;
}

function result(rows: any[] = []): SQLResultSet {
  return { rowsAffected: 0, rows: { length: rows.length, item: (index) => rows[index], _array: rows } };
}

function executeWebCatalogQuery(sql: string, params: any[]): SQLResultSet {
  const upper = sql.replace(/\s+/g, ' ').trim().toUpperCase();
  if (upper.includes('FROM LEVELS')) {
    const levels = getWebLevels();
    if (upper.includes('WHERE LEVEL = ?')) return result(levels.filter((row) => row.level === Number(params[0])));
    if (upper.includes('WHERE REQUIREDXP <=')) {
      const xp = Number(params[0]);
      return result(levels.filter((row) => row.requiredXp <= xp).slice(-1));
    }
    return result(levels);
  }
  if (upper.includes('FROM EXERCISES')) {
    let rows = getWebExercises();
    if (upper.includes('WHERE ID = ?')) rows = rows.filter((row) => row.id === params[0]);
    const equipment = params.filter((value) => typeof value === 'string' && value.startsWith('%'))
      .map((value: string) => value.slice(1, -1).toLowerCase());
    if (equipment.length) rows = rows.filter((row) => equipment.some((needle) => row.equipment.toLowerCase().includes(needle)));
    const categories = params.filter((value) => typeof value === 'string' && !value.startsWith('%'));
    if (categories.length) rows = rows.filter((row) => categories.includes(row.category));
    const limit = upper.match(/LIMIT\s+(\d+)/);
    if (limit) rows = rows.slice(0, Number(limit[1]));
    return result(rows);
  }
  throw new Error('The local catalog only supports exercise and level lookups. Personal data must use Supabase.');
}

export async function executeSql(sql: string, params: any[] = []): Promise<SQLResultSet> {
  if (Platform.OS === 'web') return executeWebCatalogQuery(sql, params);
  const db = getNativeDb();
  const trimmed = sql.trim().toUpperCase();
  if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA')) {
    const rows = await db.getAllAsync(sql, params);
    return result(rows);
  }
  const res = await db.runAsync(sql, params);
  return { insertId: res.lastInsertRowId, rowsAffected: res.changes, rows: { length: 0, item: () => null, _array: [] } };
}

export async function runMigrations(): Promise<void> {
  if (Platform.OS === 'web') {
    getWebExercises();
    getWebLevels();
    return;
  }

  const db = getNativeDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT, equipment TEXT,
      primaryMuscles TEXT, secondaryMuscles TEXT, level TEXT, instructions TEXT,
      imageUrls TEXT, defaultXP INTEGER, defaultSets INTEGER, defaultReps INTEGER,
      defaultDurationSec INTEGER
    );
    CREATE TABLE IF NOT EXISTS levels (level INTEGER PRIMARY KEY, requiredXp INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS user_profile (
      id TEXT PRIMARY KEY,
      goal TEXT,
      equipmentAvailable TEXT,
      experienceLevel TEXT,
      currentXP INTEGER DEFAULT 0,
      currentLevel INTEGER DEFAULT 1,
      currentStreak INTEGER DEFAULT 0,
      longestStreak INTEGER DEFAULT 0,
      joinDate TEXT,
      notificationTime TEXT DEFAULT '08:00',
      notificationsEnabled INTEGER DEFAULT 0,
      currentWeight REAL,
      targetWeight REAL,
      weightUnit TEXT DEFAULT 'lbs',
      email TEXT,
      displayName TEXT,
      photoUrl TEXT,
      authProvider TEXT DEFAULT 'guest'
    );
    CREATE TABLE IF NOT EXISTS daily_sets (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      date TEXT NOT NULL,
      exercises TEXT NOT NULL,
      totalXpAvailable INTEGER DEFAULT 0,
      totalXpEarned INTEGER DEFAULT 0,
      completedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS xp_transactions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      date TEXT NOT NULL,
      amount INTEGER NOT NULL,
      source TEXT
    );
  `);

  const levels = await db.getFirstAsync('SELECT count(*) as count FROM levels;');
  if (!levels?.count) {
    await db.withTransactionAsync(async () => {
      for (let level = 1; level <= 100; level += 1) {
        await db.runAsync('INSERT INTO levels (level, requiredXp) VALUES (?, ?);', [level, Math.floor(100 * Math.pow(level, 1.5))]);
      }
    });
  }

  const count = await db.getFirstAsync('SELECT count(*) as count FROM exercises;');
  if (!count?.count) {
    const rawRows = require('../../assets/free-exercise-db/dist/exercises.json');
    if (!Array.isArray(rawRows) || rawRows.length === 0) throw new Error('The bundled exercise catalog is missing or invalid.');
    await db.withTransactionAsync(async () => {
      for (const raw of rawRows) {
        const row = normalizeExercise(raw);
        await db.runAsync(
          `INSERT INTO exercises (id, name, category, equipment, primaryMuscles, secondaryMuscles, level, defaultXP, defaultSets, defaultReps, defaultDurationSec)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [row.id, row.name, row.category, row.equipment, row.primaryMuscles, row.secondaryMuscles, row.level, row.defaultXP, row.defaultSets, row.defaultReps, row.defaultDurationSec]
        );
      }
    });
  }
}

/** Clears the personal records written by app versions that used local-only storage. */
export async function clearLegacyLocalUserData(): Promise<void> {
  if (Platform.OS === 'web') {
    for (const key of [
      'fitness_level_user_profile',
      'fitness_level_daily_sets',
      'fitness_level_xp_transactions',
      'fitness_level_consent',
    ]) window.localStorage.removeItem(key);
    return;
  }
  const SQLite = require('expo-sqlite');
  const legacyDb = await SQLite.openDatabaseAsync('fitness_level.db');
  await legacyDb.closeAsync();
  await SQLite.deleteDatabaseAsync('fitness_level.db');
}

export interface LegacyLocalData {
  profile: any | null;
  dailySets: any[];
  xpTransactions: any[];
}

/** Reads former local-only user records without modifying them. */
export async function readLegacyLocalUserData(): Promise<LegacyLocalData> {
  if (Platform.OS === 'web') {
    const read = (key: string, fallback: any) => {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch {
        return fallback;
      }
    };
    return {
      profile: read('fitness_level_user_profile', null),
      dailySets: read('fitness_level_daily_sets', []),
      xpTransactions: read('fitness_level_xp_transactions', []),
    };
  }

  const SQLite = require('expo-sqlite');
  const legacyDb = await SQLite.openDatabaseAsync('fitness_level.db');
  try {
    const tables = await legacyDb.getAllAsync("SELECT name FROM sqlite_master WHERE type = 'table';");
    const names = new Set(tables.map((table: any) => table.name));
    if (!names.has('user_profile')) return { profile: null, dailySets: [], xpTransactions: [] };
    return {
      profile: await legacyDb.getFirstAsync('SELECT * FROM user_profile LIMIT 1;'),
      dailySets: names.has('daily_sets') ? await legacyDb.getAllAsync('SELECT * FROM daily_sets;') : [],
      xpTransactions: names.has('xp_transactions') ? await legacyDb.getAllAsync('SELECT * FROM xp_transactions;') : [],
    };
  } finally {
    await legacyDb.closeAsync();
  }
}

const db = { executeSql, runMigrations };
export default db;
