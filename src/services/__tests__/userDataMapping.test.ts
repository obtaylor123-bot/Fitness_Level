import { dailySetFromRow, dailySetToRow, profileFromRow, profileToRow } from '../userData';

jest.mock('../supabase', () => ({
  supabase: {},
  requireSupabase: jest.fn(),
  isSupabaseConfigured: false,
}));

describe('Supabase row mappings', () => {
  it('round-trips the profile fields used by the app', () => {
    const profile = {
      id: 'user-a', goal: 'strength', equipmentAvailable: ['dumbbell'], experienceLevel: 'beginner',
      currentXP: 30, currentLevel: 2, currentStreak: 3, longestStreak: 5, joinDate: '2026-10-26T00:00:00Z',
      notificationTime: '08:00', notificationsEnabled: true, currentWeight: 150, targetWeight: 145,
      weightUnit: 'lbs' as const, email: 'a@example.test', displayName: 'Athlete', photoUrl: undefined, authProvider: 'guest' as const,
    };
    expect(profileFromRow(profileToRow(profile))).toEqual(profile);
  });

  it('maps daily set ownership, XP and completion fields to database column names', () => {
    const dailySet = {
      id: 'set-a', userId: 'user-a', date: '2026-10-26', exercises: [],
      totalXpAvailable: 50, totalXpEarned: 20, completedAt: '2026-10-26T12:00:00Z',
    };
    expect(dailySetFromRow(dailySetToRow(dailySet))).toEqual(dailySet);
  });
});
