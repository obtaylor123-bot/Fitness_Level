// src/services/xpEngine.ts

import { executeSql } from '../db/database';
import { generateUUID as uuidv4 } from '../utils/uuid';

/**
 * Calculate base XP for a completed exercise.
 * Simple heuristic: level multiplier × sets × reps × baseXP.
 */
export function calculateExerciseXP(
  level: 'beginner' | 'intermediate' | 'expert',
  sets: number,
  reps: number,
  baseXP: number
): number {
  const levelFactor = { beginner: 1, intermediate: 1.5, expert: 2 }[level];
  return Math.round(baseXP * levelFactor * sets * reps);
}

/** Completion bonus for finishing the whole daily set (20 % of base XP). */
export function calculateCompletionBonus(totalBaseXP: number): number {
  return Math.round(totalBaseXP * 0.2);
}

/**
 * Streak bonus: +5 % per consecutive day beyond the first.
 * `streak` is the current consecutive‑day count.
 */
export function calculateStreakBonus(streak: number, totalBaseXP: number): number {
  if (streak <= 1) return 0;
  return Math.round(totalBaseXP * 0.05 * (streak - 1));
}

/** Retrieve the XP required for a given level from the `levels` table. */
export async function getXpForLevel(level: number): Promise<number> {
  const result = await executeSql(
    `SELECT requiredXp FROM levels WHERE level = ?;`,
    [level]
  );
  if (result.rows.length === 0) {
    // Fallback to the same formula if the level isn’t stored.
    return Math.round(100 * Math.pow(level, 1.5));
  }
  return result.rows.item(0).requiredXp;
}

/** Determine the current level based on accumulated XP. */
export async function getLevelForXp(xp: number): Promise<number> {
  const result = await executeSql(
    `SELECT level FROM levels WHERE requiredXp <= ? ORDER BY level DESC LIMIT 1;`,
    [xp]
  );
  return result.rows.length ? result.rows.item(0).level : 1;
}

/** Record an XP transaction in the `xp_transactions` table. */
export async function recordXpTransaction(
  userId: string,
  amount: number,
  source: string
) {
  const date = new Date().toISOString();
  const id = uuidv4();
  await executeSql(
    `INSERT INTO xp_transactions (id, userId, date, amount, source) VALUES (?, ?, ?, ?, ?);`,
    [id, userId, date, amount, source]
  );
}
