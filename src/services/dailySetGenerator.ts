// src/services/dailySetGenerator.ts

import { executeSql } from '../db/database';
import { Exercise } from '../models/Exercise';
import { DailySet, DailyExerciseEntry } from '../models/DailySet';
import { UserProfile } from '../models/UserProfile';
import { generateUUID as uuidv4 } from '../utils/uuid';
import { subDays, formatISO } from 'date-fns';

/**
 * Generate a daily workout set for a user that strictly honors their preferences.
 */
export async function generateDailySet(userId: string, date: Date = new Date()): Promise<DailySet> {
  // Load user profile
  const userRes = await executeSql('SELECT * FROM user_profile WHERE id = ?;', [userId]);
  if (userRes.rows.length === 0) throw new Error('User profile not found');
  const rawUser = userRes.rows.item(0);

  // Normalize equipmentAvailable to an array of strings
  let equipmentAvailable: string[] = [];
  if (Array.isArray(rawUser.equipmentAvailable)) {
    equipmentAvailable = rawUser.equipmentAvailable;
  } else if (typeof rawUser.equipmentAvailable === 'string') {
    try {
      const parsed = JSON.parse(rawUser.equipmentAvailable);
      equipmentAvailable = Array.isArray(parsed) ? parsed : [rawUser.equipmentAvailable];
    } catch {
      equipmentAvailable = rawUser.equipmentAvailable
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
  }

  // If user selected no equipment, default to bodyweight
  if (equipmentAvailable.length === 0) {
    equipmentAvailable = ['bodyweight'];
  }

  const user: UserProfile = {
    ...rawUser,
    equipmentAvailable,
  };

  // Determine rest day (every 6th day)
  const joinTime = user.joinDate ? new Date(user.joinDate).getTime() : date.getTime();
  const daysSinceJoin = Math.floor((date.getTime() - joinTime) / (1000 * 60 * 60 * 24));
  const isRestDay = daysSinceJoin > 0 && daysSinceJoin % 6 === 0;

  // Gather primary muscles used in the last 3 days
  const recentDates = [1, 2, 3].map(d => formatISO(subDays(date, d), { representation: 'date' }));
  const placeholders = recentDates.map(() => '?').join(',');
  const recentRows = await executeSql(
    `SELECT exercises FROM daily_sets WHERE userId = ? AND date IN (${placeholders});`,
    [userId, ...recentDates]
  );
  const recentMuscles = new Set<string>();
  for (let i = 0; i < recentRows.rows.length; i++) {
    const row = recentRows.rows.item(i);
    try {
      const entries: DailyExerciseEntry[] = typeof row.exercises === 'string' ? JSON.parse(row.exercises) : row.exercises;
      if (Array.isArray(entries)) {
        for (const e of entries) {
          const exRes = await executeSql('SELECT primaryMuscles FROM exercises WHERE id = ?;', [e.exerciseId]);
          if (exRes.rows.length) {
            const pcs = exRes.rows.item(0).primaryMuscles?.split(', ') ?? [];
            pcs.forEach((m: string) => recentMuscles.add(m.trim().toLowerCase()));
          }
        }
      }
    } catch {
      // ignore parse issues
    }
  }

  // Map user equipment selection to database equipment keywords
  const expandedEquipment: string[] = [];
  for (const eq of equipmentAvailable) {
    const lower = eq.toLowerCase().trim();
    if (lower === 'bodyweight' || lower === 'body only') {
      expandedEquipment.push('body only', 'bodyweight');
    } else if (lower === 'kettlebell' || lower === 'kettlebells') {
      expandedEquipment.push('kettlebell', 'kettlebells');
    } else if (lower === 'barbell') {
      expandedEquipment.push('barbell', 'e-z curl bar');
    } else if (lower === 'machine') {
      expandedEquipment.push('machine', 'cable');
    } else if (lower === 'dumbbell') {
      expandedEquipment.push('dumbbell');
    } else {
      expandedEquipment.push(lower);
    }
  }

  // Map user goal to exercise categories
  const goalMap: Record<string, string[]> = {
    strength: ['strength', 'powerlifting', 'olympic weightlifting'],
    cardio: ['cardio', 'plyometrics'],
    mobility: ['stretching', 'mobility'],
    general: ['strength', 'cardio', 'stretching', 'plyometrics']
  };
  const categories = goalMap[user.goal] ?? goalMap['general'];

  // Build SQL query
  const where: string[] = [];
  const params: any[] = [];

  // Filter by equipment
  where.push('(' + expandedEquipment.map(() => 'equipment LIKE ?').join(' OR ') + ')');
  expandedEquipment.forEach((eq: string) => params.push(`%${eq}%`));

  // Filter by category
  where.push(`category IN (${categories.map(() => '?').join(',')})`);
  params.push(...categories);

  const candidateRes = await executeSql(
    `SELECT * FROM exercises WHERE ${where.join(' AND ')}`,
    params
  );

  let allMatchingExercises: Exercise[] = [];
  for (let i = 0; i < candidateRes.rows.length; i++) {
    const row = candidateRes.rows.item(i) as any;
    allMatchingExercises.push({
      id: row.id,
      name: row.name,
      category: row.category,
      equipment: row.equipment,
      primaryMuscles: row.primaryMuscles,
      secondaryMuscles: row.secondaryMuscles,
      level: row.level,
      defaultXP: row.defaultXP || 20,
      defaultSets: row.defaultSets || 3,
      defaultReps: row.defaultReps || 10,
      defaultDurationSec: row.defaultDurationSec || 0,
    });
  }

  // If strict combination yielded no exercises (e.g. cardio with barbell),
  // search by equipment first to ALWAYS respect user's physical gear!
  if (allMatchingExercises.length === 0) {
    const eqWhere = '(' + expandedEquipment.map(() => 'equipment LIKE ?').join(' OR ') + ')';
    const eqParams = expandedEquipment.map(eq => `%${eq}%`);
    const fallbackEqRes = await executeSql(
      `SELECT * FROM exercises WHERE ${eqWhere} LIMIT 30;`,
      eqParams
    );
    for (let i = 0; i < fallbackEqRes.rows.length; i++) {
      const row = fallbackEqRes.rows.item(i) as any;
      allMatchingExercises.push({
        id: row.id,
        name: row.name,
        category: row.category,
        equipment: row.equipment,
        primaryMuscles: row.primaryMuscles,
        secondaryMuscles: row.secondaryMuscles,
        level: row.level,
        defaultXP: row.defaultXP || 20,
        defaultSets: row.defaultSets || 3,
        defaultReps: row.defaultReps || 10,
        defaultDurationSec: row.defaultDurationSec || 0,
      });
    }
  }

  // Filter out recent muscles if possible without dropping to zero
  let candidates = allMatchingExercises.filter((ex) => {
    const primary = ex.primaryMuscles ? ex.primaryMuscles.split(',').map(m => m.trim().toLowerCase()) : [];
    return !primary.some(m => recentMuscles.has(m));
  });

  // If recent muscle filter left too few exercises, use all matching equipment exercises
  if (candidates.length < 3) {
    candidates = allMatchingExercises;
  }

  const chosen: DailyExerciseEntry[] = [];
  if (isRestDay) {
    const stretch = candidates.find(c => c.category === 'stretching') || candidates[0];
    if (stretch) {
      chosen.push({
        exerciseId: stretch.id,
        name: stretch.name,
        category: stretch.category,
        equipment: stretch.equipment,
        level: stretch.level || 'beginner',
        targetSets: 1,
        targetReps: 0,
        xpValue: stretch.defaultXP || 15,
        completed: false,
      });
    }
  } else {
    const count = Math.min(candidates.length, Math.max(3, Math.floor(Math.random() * 3) + 4));
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    for (let i = 0; i < count && i < shuffled.length; i++) {
      const ex = shuffled[i];
      chosen.push({
        exerciseId: ex.id,
        name: ex.name,
        category: ex.category,
        equipment: ex.equipment,
        level: ex.level || 'beginner',
        targetSets: ex.defaultSets || 3,
        targetReps: ex.defaultReps || 12,
        xpValue: ex.defaultXP || 20,
        completed: false,
      });
    }
  }

  const totalXpAvailable = chosen.reduce((s, e) => s + e.xpValue, 0);

  const dailySet: DailySet = {
    id: uuidv4(),
    userId,
    date: formatISO(date, { representation: 'date' }),
    exercises: chosen,
    totalXpAvailable,
    totalXpEarned: 0,
  };

  await executeSql(
    `INSERT INTO daily_sets (id, userId, date, exercises, totalXpAvailable, totalXpEarned) VALUES (?, ?, ?, ?, ?, ?);`,
    [dailySet.id, userId, dailySet.date, JSON.stringify(chosen), totalXpAvailable, 0]
  );

  return dailySet;
}
