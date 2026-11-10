import { formatISO } from 'date-fns';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { DailySet } from '../models/DailySet';
import { UserProfile } from '../models/UserProfile';
import { clearLegacyLocalUserData } from '../db/database';
import { generateUUID } from '../utils/uuid';
import { isSupabaseConfigured, requireSupabase, supabase } from './supabase';
import { runAccountDeletion } from './accountDeletionFlow';
import {
  isGuestId,
  getSavedGuestProfile,
  saveGuestProfile,
  getGuestDailySet,
  saveGuestDailySet,
  getGuestDailySets,
  getGuestDailySetsByDates,
  recordGuestXp,
  getGuestXpTransactions,
  clearGuestSession,
} from '../utils/guestSession';

function raise(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

type ProfileRow = {
  id: string;
  goal: string;
  equipment_available: string[];
  experience_level: string;
  current_xp: number;
  current_level: number;
  current_streak: number;
  longest_streak: number;
  join_date: string;
  notification_time: string;
  notifications_enabled: boolean;
  current_weight: number | null;
  target_weight: number | null;
  weight_unit: 'lbs' | 'kg' | null;
  email: string | null;
  display_name: string | null;
  photo_url: string | null;
  auth_provider: 'google' | 'email' | 'guest';
};

export function profileFromRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    goal: row.goal,
    equipmentAvailable: row.equipment_available ?? [],
    experienceLevel: row.experience_level,
    currentXP: row.current_xp,
    currentLevel: row.current_level,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    joinDate: row.join_date,
    notificationTime: row.notification_time,
    notificationsEnabled: row.notifications_enabled,
    currentWeight: row.current_weight ?? undefined,
    targetWeight: row.target_weight ?? undefined,
    weightUnit: row.weight_unit ?? 'lbs',
    email: row.email ?? undefined,
    displayName: row.display_name ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    authProvider: row.auth_provider,
  };
}

export function profileToRow(profile: UserProfile) {
  return {
    id: profile.id,
    goal: profile.goal,
    equipment_available: profile.equipmentAvailable,
    experience_level: profile.experienceLevel,
    current_xp: profile.currentXP,
    current_level: profile.currentLevel,
    current_streak: profile.currentStreak,
    longest_streak: profile.longestStreak,
    join_date: profile.joinDate,
    notification_time: profile.notificationTime,
    notifications_enabled: Boolean(profile.notificationsEnabled),
    current_weight: profile.currentWeight ?? null,
    target_weight: profile.targetWeight ?? null,
    weight_unit: profile.weightUnit ?? 'lbs',
    email: profile.email ?? null,
    display_name: profile.displayName ?? null,
    photo_url: profile.photoUrl ?? null,
    auth_provider: profile.authProvider ?? 'email',
  };
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (isGuestId(userId) || !isSupabaseConfigured) {
    return getSavedGuestProfile();
  }
  const { data, error } = await requireSupabase()
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  raise(error);
  return data ? profileFromRow(data as ProfileRow) : null;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  if (isGuestId(profile.id) || profile.authProvider === 'guest' || !isSupabaseConfigured) {
    await saveGuestProfile(profile);
    return;
  }
  const { error } = await requireSupabase()
    .from('user_profiles')
    .upsert(profileToRow(profile), { onConflict: 'id' });
  raise(error);
}

export async function updateUserProfile(userId: string, patch: Partial<UserProfile>): Promise<void> {
  if (isGuestId(userId) || !isSupabaseConfigured) {
    const current = await getSavedGuestProfile();
    if (current) {
      const merged = { ...current, ...patch };
      await saveGuestProfile(merged);
    }
    return;
  }
  const columns: Record<keyof UserProfile, string> = {
    id: 'id', goal: 'goal', equipmentAvailable: 'equipment_available',
    experienceLevel: 'experience_level', currentXP: 'current_xp',
    currentLevel: 'current_level', currentStreak: 'current_streak',
    longestStreak: 'longest_streak', joinDate: 'join_date',
    notificationTime: 'notification_time', notificationsEnabled: 'notifications_enabled',
    currentWeight: 'current_weight', targetWeight: 'target_weight', weightUnit: 'weight_unit',
    email: 'email', displayName: 'display_name', photoUrl: 'photo_url', authProvider: 'auth_provider',
  };
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch) as [keyof UserProfile, unknown][]) {
    if (key !== 'id' && columns[key]) row[columns[key]] = value ?? null;
  }
  if (!Object.keys(row).length) return;
  const { error } = await requireSupabase().from('user_profiles').update(row).eq('id', userId);
  raise(error);
}

export function dailySetFromRow(row: {
  id: string; user_id: string; date: string; exercises: DailySet['exercises'];
  total_xp_available: number; total_xp_earned: number; completed_at: string | null;
}): DailySet {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    exercises: row.exercises,
    totalXpAvailable: row.total_xp_available,
    totalXpEarned: row.total_xp_earned,
    completedAt: row.completed_at ?? undefined,
  };
}

export function dailySetToRow(set: DailySet) {
  return {
    id: set.id,
    user_id: set.userId,
    date: set.date,
    exercises: set.exercises,
    total_xp_available: set.totalXpAvailable,
    total_xp_earned: set.totalXpEarned,
    completed_at: set.completedAt ?? null,
  };
}

export async function getDailySet(userId: string, date: Date = new Date()): Promise<DailySet | null> {
  const day = formatISO(date, { representation: 'date' });
  if (isGuestId(userId) || !isSupabaseConfigured) {
    return getGuestDailySet(userId, day);
  }
  const { data, error } = await requireSupabase()
    .from('daily_sets').select('*').eq('user_id', userId).eq('date', day).maybeSingle();
  raise(error);
  return data ? dailySetFromRow(data) : null;
}

export async function getDailySets(userId: string, limit = 30): Promise<DailySet[]> {
  if (isGuestId(userId) || !isSupabaseConfigured) {
    return getGuestDailySets(userId, limit);
  }
  const { data, error } = await requireSupabase()
    .from('daily_sets').select('*').eq('user_id', userId)
    .order('date', { ascending: false }).limit(limit);
  raise(error);
  return (data ?? []).map(dailySetFromRow);
}

export async function getDailySetsByDates(userId: string, dates: string[]): Promise<DailySet[]> {
  if (!dates.length) return [];
  if (isGuestId(userId) || !isSupabaseConfigured) {
    return getGuestDailySetsByDates(userId, dates);
  }
  const { data, error } = await requireSupabase()
    .from('daily_sets').select('*').eq('user_id', userId).in('date', dates);
  raise(error);
  return (data ?? []).map(dailySetFromRow);
}

export async function saveDailySet(set: DailySet): Promise<void> {
  if (isGuestId(set.userId) || !isSupabaseConfigured) {
    await saveGuestDailySet(set);
    return;
  }
  const { error } = await requireSupabase()
    .from('daily_sets').upsert(dailySetToRow(set), { onConflict: 'user_id,date' });
  raise(error);
}

export async function updateDailySet(set: DailySet): Promise<void> {
  if (isGuestId(set.userId) || !isSupabaseConfigured) {
    await saveGuestDailySet(set);
    return;
  }
  const { error } = await requireSupabase().from('daily_sets')
    .update({ exercises: set.exercises, total_xp_earned: set.totalXpEarned, completed_at: set.completedAt ?? null })
    .eq('id', set.id).eq('user_id', set.userId);
  raise(error);
}

export interface XpTransaction {
  id: string;
  userId: string;
  date: string;
  amount: number;
  source: string;
}

export async function recordXp(userId: string, id: string, amount: number, source: string): Promise<void> {
  if (isGuestId(userId) || !isSupabaseConfigured) {
    await recordGuestXp(userId, id, amount, source);
    return;
  }
  const { error } = await requireSupabase().from('xp_transactions').insert({
    id, user_id: userId, amount, source,
  });
  raise(error);
}

export async function importXpTransactions(userId: string, transactions: any[]): Promise<void> {
  for (let offset = 0; offset < transactions.length; offset += 100) {
    const rows = transactions.slice(offset, offset + 100).map((row) => ({
      id: isUuid(row.id) ? row.id : generateUUID(),
      user_id: userId,
      amount: Math.max(0, Math.trunc(Number(row.amount) || 0)),
      source: String(row.source ?? 'Imported workout history').slice(0, 120),
      created_at: validTimestamp(row.date) ? new Date(row.date).toISOString() : new Date().toISOString(),
    }));
    if (!rows.length) continue;
    const { error } = await requireSupabase().from('xp_transactions').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    raise(error);
  }
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export async function getXpTransactions(userId: string, limit = 30): Promise<XpTransaction[]> {
  if (isGuestId(userId) || !isSupabaseConfigured) {
    return getGuestXpTransactions(userId, limit);
  }
  const { data, error } = await requireSupabase().from('xp_transactions')
    .select('id,user_id,created_at,amount,source').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(limit);
  raise(error);
  return (data ?? []).map((row: any) => ({
    id: row.id, userId: row.user_id, date: row.created_at, amount: row.amount, source: row.source,
  }));
}

export async function getConsentAcceptedAt(userId: string): Promise<string | null> {
  if (isGuestId(userId) || !isSupabaseConfigured) {
    return new Date().toISOString();
  }
  const { data, error } = await requireSupabase().from('user_consents')
    .select('accepted_at').eq('user_id', userId).maybeSingle();
  raise(error);
  return data?.accepted_at ?? null;
}

export async function saveConsentAcceptedAt(userId: string, acceptedAt: string): Promise<void> {
  if (isGuestId(userId) || !isSupabaseConfigured) return;
  const { error } = await requireSupabase().from('user_consents')
    .upsert({
      user_id: userId,
      accepted_at: acceptedAt,
      policy_version: '2026-10-26',
      terms_version: '2026-10-26',
    }, { onConflict: 'user_id' });
  raise(error);
}

const PENDING_DELETION_CLEANUP_KEY = 'fitness_level_pending_deletion_cleanup';

async function clearDeletedAccountDeviceData(): Promise<void> {
  await clearGuestSession();
  await clearLegacyLocalUserData();
  if (Platform.OS !== 'web') await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function hasPendingDeletionCleanup(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(PENDING_DELETION_CLEANUP_KEY)) === 'pending';
  } catch {
    return false;
  }
}

/** Retries cleanup left over after cloud deletion succeeded but the device was unavailable. */
export async function retryPendingDeletionCleanup(): Promise<void> {
  if (!(await hasPendingDeletionCleanup())) return;
  await clearDeletedAccountDeviceData();
  await SecureStore.deleteItemAsync(PENDING_DELETION_CLEANUP_KEY);
}

export async function requestAccountDeletion() {
  let recoveryMarkerSaved = false;
  const result = await runAccountDeletion({
    deleteCloudAccount: async () => {
      const { error } = await requireSupabase().functions.invoke('delete-account', { body: {} });
      if (error) throw new Error('The account deletion request could not be completed. Check your connection and retry.');
      try {
        await SecureStore.setItemAsync(PENDING_DELETION_CLEANUP_KEY, 'pending');
        recoveryMarkerSaved = true;
      } catch {}
    },
    clearLocalRecords: async () => {
      await clearGuestSession();
      await clearLegacyLocalUserData();
    },
    cancelReminders: async () => {
      if (Platform.OS !== 'web') await Notifications.cancelAllScheduledNotificationsAsync();
    },
    signOutLocal: async () => {
      await clearGuestSession();
      if (isSupabaseConfigured) {
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {}
      }
    },
  });
  if (result.localRecordsCleared && result.remindersCancelled && recoveryMarkerSaved) {
    try {
      await SecureStore.deleteItemAsync(PENDING_DELETION_CLEANUP_KEY);
    } catch {}
  }
  return { ...result, recoveryMarkerSaved };
}
