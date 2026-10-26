// src/models/DailySet.ts

export interface DailyExerciseEntry {
  exerciseId: string;
  name?: string;
  category?: string;
  equipment?: string;
  level?: 'beginner' | 'intermediate' | 'expert' | string;
  targetSets: number;
  targetReps: number;
  xpValue: number;
  completed: boolean;
}

export interface DailySet {
  id: string;
  userId: string;
  date: string;
  exercises: DailyExerciseEntry[];
  totalXpAvailable: number;
  totalXpEarned: number;
  completedAt?: string;
}
