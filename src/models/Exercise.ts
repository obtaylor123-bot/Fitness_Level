// src/models/Exercise.ts

export interface Exercise {
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
  instructions?: string;
  imageUrls?: string;
}
