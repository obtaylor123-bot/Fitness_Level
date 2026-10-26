// src/models/UserProfile.ts

export interface UserProfile {
  id: string;
  goal: string;
  equipmentAvailable: string[];
  experienceLevel: string;
  currentXP: number;
  currentLevel: number;
  currentStreak: number;
  longestStreak: number;
  joinDate: string;
  notificationTime: string;
  notificationsEnabled?: boolean;

  // Personal goals and body metrics
  currentWeight?: number;
  targetWeight?: number;
  weightUnit?: 'lbs' | 'kg';

  // Authentication status
  email?: string;
  displayName?: string;
  photoUrl?: string;
  authProvider?: 'google' | 'guest';
}
