-- src/db/migrations/001_init.sql

-- Exercises table
CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  equipment TEXT,            -- JSON array stored as TEXT
  primaryMuscles TEXT,       -- JSON array stored as TEXT
  secondaryMuscles TEXT,     -- JSON array stored as TEXT
  level TEXT,
  instructions TEXT,        -- JSON array stored as TEXT
  imageUrls TEXT,            -- JSON array stored as TEXT
  defaultXP INTEGER,
  defaultSets INTEGER,
  defaultReps INTEGER,
  defaultDurationSec INTEGER
);

-- Daily sets generated per user per day
CREATE TABLE IF NOT EXISTS daily_sets (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  date TEXT NOT NULL,          -- ISO date string (YYYY-MM-DD)
  exercises TEXT NOT NULL,    -- JSON array of DailyExerciseEntry
  totalXpAvailable INTEGER,
  totalXpEarned INTEGER,
  completedAt TEXT              -- ISO timestamp
);

-- User profile
CREATE TABLE IF NOT EXISTS user_profile (
  id TEXT PRIMARY KEY,
  goal TEXT,
  equipmentAvailable TEXT,    -- JSON array stored as TEXT
  experienceLevel TEXT,
  currentXP INTEGER,
  currentLevel INTEGER,
  currentStreak INTEGER,
  longestStreak INTEGER,
  joinDate TEXT,
  notificationTime TEXT        -- HH:MM 24‑hour format, default "08:00"
);

-- XP transactions (history of XP gains)
CREATE TABLE IF NOT EXISTS xp_transactions (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  date TEXT NOT NULL,          -- ISO date
  amount INTEGER NOT NULL,
  source TEXT                  -- exerciseId|completionBonus|streakBonus
);

-- Levels table – stores required XP per level for quick lookup
CREATE TABLE IF NOT EXISTS levels (
  level INTEGER PRIMARY KEY,
  requiredXp INTEGER NOT NULL
);

-- Populate levels table with a reasonable curve up to level 100
INSERT OR IGNORE INTO levels (level, requiredXp)
SELECT i, CAST(100 * POWER(i, 1.5) AS INTEGER)
FROM generate_series(1, 100) AS t(i);
