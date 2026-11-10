// src/utils/guestSession.ts
//
// Standalone local storage for Guest users:
// Manages guest profile, daily sets, and XP transactions in SecureStore (native)
// and localStorage (web) without querying any remote server or SQLite tables.

import { Platform } from 'react-native';
import { generateUUID } from './uuid';
import { UserProfile } from '../models/UserProfile';
import { DailySet } from '../models/DailySet';
import { XpTransaction } from '../services/userData';

const GUEST_PROFILE_KEY = 'fitness_level_guest_profile_v1';
const GUEST_DAILY_SETS_KEY = 'fitness_level_guest_daily_sets_v1';
const GUEST_XP_TX_KEY = 'fitness_level_guest_xp_tx_v1';

// In-memory cache for ultra-fast access
let cachedProfile: UserProfile | null = null;
let cachedDailySets: DailySet[] | null = null;
let cachedXpTx: XpTransaction[] | null = null;

async function storageGet(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    }
    const SecureStore = require('expo-secure-store');
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function storageSet(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
    } else {
      const SecureStore = require('expo-secure-store');
      await SecureStore.setItemAsync(key, value);
    }
  } catch (err) {
    console.warn(`guestSession storageSet error for ${key}:`, err);
  }
}

async function storageRemove(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    } else {
      const SecureStore = require('expo-secure-store');
      await SecureStore.deleteItemAsync(key);
    }
  } catch {}
}

export function isGuestId(userId?: string | null): boolean {
  if (!userId) return false;
  return userId.startsWith('guest_') || userId.includes('guest');
}

/**
 * Creates a brand-new guest profile immediately without querying any database or server.
 */
export async function createGuestProfile(): Promise<UserProfile> {
  const newGuest: UserProfile = {
    id: `guest_${generateUUID().slice(0, 12)}`,
    goal: 'strength',
    equipmentAvailable: ['bodyweight'],
    experienceLevel: 'beginner',
    currentXP: 0,
    currentLevel: 1,
    currentStreak: 0,
    longestStreak: 0,
    joinDate: new Date().toISOString(),
    notificationTime: '08:00',
    notificationsEnabled: false,
    authProvider: 'guest',
    displayName: 'Guest Athlete',
    weightUnit: 'lbs',
  };

  cachedProfile = newGuest;
  await storageSet(GUEST_PROFILE_KEY, JSON.stringify(newGuest));
  return newGuest;
}

/**
 * Returns saved guest profile if one exists on this device, or null.
 */
export async function getSavedGuestProfile(): Promise<UserProfile | null> {
  if (cachedProfile) return cachedProfile;
  const raw = await storageGet(GUEST_PROFILE_KEY);
  if (!raw) return null;
  try {
    cachedProfile = JSON.parse(raw);
    return cachedProfile;
  } catch {
    return null;
  }
}

/**
 * Saves/updates guest profile.
 */
export async function saveGuestProfile(profile: UserProfile): Promise<void> {
  cachedProfile = profile;
  await storageSet(GUEST_PROFILE_KEY, JSON.stringify(profile));
}

/**
 * Clears guest session on sign out.
 */
export async function clearGuestSession(): Promise<void> {
  cachedProfile = null;
  cachedDailySets = null;
  cachedXpTx = null;
  await storageRemove(GUEST_PROFILE_KEY);
  await storageRemove(GUEST_DAILY_SETS_KEY);
  await storageRemove(GUEST_XP_TX_KEY);
}

// ─── GUEST DAILY SETS ────────────────────────────────────────────────────────

async function loadGuestDailySets(): Promise<DailySet[]> {
  if (cachedDailySets) return cachedDailySets;
  const raw = await storageGet(GUEST_DAILY_SETS_KEY);
  if (!raw) {
    cachedDailySets = [];
    return [];
  }
  try {
    cachedDailySets = JSON.parse(raw);
    return cachedDailySets || [];
  } catch {
    cachedDailySets = [];
    return [];
  }
}

export async function getGuestDailySet(userId: string, dateStr?: string): Promise<DailySet | null> {
  const sets = await loadGuestDailySets();
  const targetDate = dateStr || new Date().toISOString().slice(0, 10);
  const found = sets.find((s) => s.userId === userId && s.date === targetDate);
  return found || null;
}

export async function saveGuestDailySet(set: DailySet): Promise<void> {
  const sets = await loadGuestDailySets();
  const index = sets.findIndex((s) => (s.id && s.id === set.id) || (s.userId === set.userId && s.date === set.date));
  if (index >= 0) {
    sets[index] = set;
  } else {
    sets.unshift(set);
  }
  cachedDailySets = sets;
  await storageSet(GUEST_DAILY_SETS_KEY, JSON.stringify(sets));
}

export async function getGuestDailySets(userId: string, limit = 30): Promise<DailySet[]> {
  const sets = await loadGuestDailySets();
  return sets.filter((s) => s.userId === userId).slice(0, limit);
}

export async function getGuestDailySetsByDates(userId: string, dates: string[]): Promise<DailySet[]> {
  const sets = await loadGuestDailySets();
  return sets.filter((s) => s.userId === userId && dates.includes(s.date));
}

// ─── GUEST XP TRANSACTIONS ───────────────────────────────────────────────────

async function loadGuestXpTx(): Promise<XpTransaction[]> {
  if (cachedXpTx) return cachedXpTx;
  const raw = await storageGet(GUEST_XP_TX_KEY);
  if (!raw) {
    cachedXpTx = [];
    return [];
  }
  try {
    cachedXpTx = JSON.parse(raw);
    return cachedXpTx || [];
  } catch {
    cachedXpTx = [];
    return [];
  }
}

export async function recordGuestXp(
  userId: string,
  id: string,
  amount: number,
  source: string,
): Promise<void> {
  const list = await loadGuestXpTx();
  const tx: XpTransaction = {
    id,
    userId,
    date: new Date().toISOString(),
    amount,
    source,
  };
  list.unshift(tx);
  cachedXpTx = list.slice(0, 100);
  await storageSet(GUEST_XP_TX_KEY, JSON.stringify(cachedXpTx));
}

export async function getGuestXpTransactions(userId: string, limit = 30): Promise<XpTransaction[]> {
  const list = await loadGuestXpTx();
  return list.filter((tx) => tx.userId === userId).slice(0, limit);
}
