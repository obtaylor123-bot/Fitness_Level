// scripts/import_exercises.ts

import { executeSql } from '../src/db/database';
import * as fs from 'fs';
import * as path from 'path';

// Path to the bundled dataset (relative to project root)
const EXERCISES_JSON = path.resolve(__dirname, '../assets/free-exercise-db/dist/exercises.json');

interface RawExercise {
  id: string;
  name: string;
  category: string;
  equipment: string | string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  level: string; // beginner | intermediate | expert
  force: string | null;
  mechanic: string | null;
  instructions: string[];
  images: string[];
}

interface Exercise {
  id: string;
  name: string;
  category: string;
  equipment: string;
  primaryMuscles: string;
  secondaryMuscles: string;
  level: string;
  defaultXP: number;
  defaultSets: number;
  defaultReps: number;
  defaultDurationSec: number;
}

function normalize(raw: RawExercise): Exercise {
  const levelFactor = raw.level === 'expert' ? 3 : raw.level === 'intermediate' ? 2 : 1;
  const defaultXP = 10 * levelFactor; // base XP per exercise
  const defaultSets = raw.category === 'cardio' ? 1 : 3;
  const defaultReps = raw.category === 'cardio' ? 0 : 12;
  const defaultDurationSec = raw.category === 'cardio' ? 180 : 0; // placeholder 3‑min cardio
  const equipment = Array.isArray(raw.equipment) ? raw.equipment.join(', ') : raw.equipment;
  return {
    id: raw.id,
    name: raw.name,
    category: raw.category,
    equipment,
    primaryMuscles: raw.primaryMuscles.join(', '),
    secondaryMuscles: raw.secondaryMuscles.join(', '),
    level: raw.level,
    defaultXP,
    defaultSets,
    defaultReps,
    defaultDurationSec,
  };
}

async function importExercises() {
  const rawData = JSON.parse(fs.readFileSync(EXERCISES_JSON, 'utf8')) as RawExercise[];
  const exercises = rawData.map(normalize);

  await executeSql('BEGIN TRANSACTION;');
  const insertStmt = `INSERT OR REPLACE INTO exercises (id, name, category, equipment, primaryMuscles, secondaryMuscles, level, defaultXP, defaultSets, defaultReps, defaultDurationSec)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
  for (const ex of exercises) {
    await executeSql(insertStmt, [
      ex.id,
      ex.name,
      ex.category,
      ex.equipment,
      ex.primaryMuscles,
      ex.secondaryMuscles,
      ex.level,
      ex.defaultXP,
      ex.defaultSets,
      ex.defaultReps,
      ex.defaultDurationSec,
    ]);
  }

  // Seed level table (1‑100) using the same XP curve
  const levelStmt = `INSERT OR REPLACE INTO levels (level, requiredXp) VALUES (?, ?);`;
  for (let lvl = 1; lvl <= 100; lvl++) {
    const xp = Math.floor(100 * Math.pow(lvl, 1.5));
    await executeSql(levelStmt, [lvl, xp]);
  }

  await executeSql('COMMIT;');
  console.log(`Imported ${exercises.length} exercises and seeded 100 levels.`);
}

importExercises().catch(err => console.error('Import failed:', err));
