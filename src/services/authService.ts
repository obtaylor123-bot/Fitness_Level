// src/services/authService.ts
//
// Guest sign-in: fully local — no Supabase required. Works in Expo Go.
// Google sign-in: requires a development build (custom scheme not supported in Expo Go).
// Email sign-in: requires Supabase to be configured.

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase, isSupabaseConfigured, requireSupabase } from './supabase';
import { generateUUID } from '../utils/uuid';
import { useStore } from '../store';
import { executeSql, runMigrations } from '../db/database';

WebBrowser.maybeCompleteAuthSession();

const AUTH_REQUEST_TIMEOUT_MS = 15_000;
const OAUTH_TIMEOUT_MS = 120_000;

function withTimeout<T>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([operation, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export const AUTH_REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: 'fitnesslevel',
  path: 'auth/callback',
});

// ─── GUEST SIGN-IN (local only, no Supabase) ───────────────────────────────
// Creates a UUID-based user ID in local SQLite and stores it.
// The rest of the app uses this ID just like a Supabase user ID.
const LOCAL_GUEST_ID_KEY = 'fitness_level_local_guest_id';

export async function getOrCreateLocalGuestId(): Promise<string> {
  // Try to read an existing guest ID from SQLite user_profile
  await runMigrations();
  const result = await executeSql('SELECT id FROM user_profile LIMIT 1;');
  if (result.rows.length > 0) {
    return result.rows.item(0).id as string;
  }
  // Create a new guest ID
  return generateUUID();
}

/**
 * Signs in as a local guest. No network call — works in Expo Go on any device.
 * Sets authUserId in the store, then rehydrateStore() will load or prompt onboarding.
 */
export async function signInAsGuest(): Promise<void> {
  const { setAuthUserId, setAuthReady, setConsentAcceptedAt, setHydrated } = useStore.getState();
  const guestId = await getOrCreateLocalGuestId();
  // Mark consent as accepted for guest (they accepted by pressing "Continue as guest")
  setConsentAcceptedAt(new Date().toISOString());
  setAuthUserId(guestId);
  setAuthReady(true);
  // rehydrateStore is called by App.tsx when authUserId changes — it will
  // find no profile and show OnboardingFlow, or load the existing one.
}

// ─── GOOGLE SIGN-IN (requires Supabase + dev build) ────────────────────────
export async function signInWithGoogle(): Promise<void> {
  // Expo Go cannot handle the fitnesslevel:// callback scheme.
  // This will only work in a standalone/development build.
  const client = requireSupabase();
  const { data, error } = await withTimeout(
    client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: AUTH_REDIRECT_URI, skipBrowserRedirect: true },
    }),
    AUTH_REQUEST_TIMEOUT_MS,
    'Could not reach Supabase. Check your network and Supabase configuration.',
  );
  if (error) {
    if (/provider.*(not enabled|disabled|not configured)|unsupported provider/i.test(error.message)) {
      throw new Error('Google sign-in is not enabled in your Supabase project. Enable the Google provider in Supabase Auth settings.');
    }
    throw error;
  }
  if (!data.url) throw new Error('Supabase did not return a Google sign-in URL.');

  const result = await withTimeout(
    WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT_URI),
    OAUTH_TIMEOUT_MS,
    'Google sign-in timed out.',
  );
  if (result.type === 'success' && result.url) {
    const { error: exchangeError } = await client.auth.exchangeCodeForSession(result.url);
    if (exchangeError) throw exchangeError;
  } else if (result.type === 'cancel' || result.type === 'dismiss') {
    return;
  } else {
    throw new Error(
      'Google sign-in could not complete in Expo Go.\n\n' +
      'Expo Go does not support custom URL schemes (fitnesslevel://).\n\n' +
      'To use Google sign-in, create a development build:\n  npx expo run:android'
    );
  }
}

// ─── EMAIL SIGN-IN (requires Supabase) ────────────────────────────────────
export async function signInWithEmail(email: string, password: string, createAccount: boolean): Promise<boolean> {
  const client = requireSupabase();
  const result = createAccount
    ? await client.auth.signUp({ email, password })
    : await client.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  return Boolean(result.data.session);
}

// ─── SIGN OUT ──────────────────────────────────────────────────────────────
export async function signOut(): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
  // For local guests, just clear the store — App.tsx handles the rest
}
