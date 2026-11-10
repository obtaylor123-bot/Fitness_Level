// src/services/authService.ts
//
// Guest sign-in: Creates a guest user immediately on this device — no querying, no network!
// Google sign-in: Requires a development build (custom scheme not supported in Expo Go).
// Email sign-in: Requires Supabase to be configured.

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase, isSupabaseConfigured, requireSupabase } from './supabase';
import {
  createGuestProfile,
  getSavedGuestProfile,
  clearGuestSession,
} from '../utils/guestSession';
import { useStore } from '../store';
import { UserProfile } from '../models/UserProfile';

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

// ─── GUEST SIGN-IN ─────────────────────────────────────────────────────────
/**
 * Creates a guest sign-in immediately when pressed for the first time on a device,
 * without querying any database tables or remote servers.
 */
export async function signInAsGuest(): Promise<UserProfile> {
  const { setUser, setAuthUserId, setAuthReady, setConsentAcceptedAt, setHydrated } = useStore.getState();

  // If a guest already exists on this device, restore it; otherwise create a brand new guest!
  let guest = await getSavedGuestProfile();
  if (!guest) {
    guest = await createGuestProfile();
  }

  // Set the store immediately — no querying, no delay, no table errors!
  setConsentAcceptedAt(new Date().toISOString());
  setAuthUserId(guest.id);
  setUser(guest);
  setHydrated(true);
  setAuthReady(true);

  return guest;
}

// ─── GOOGLE SIGN-IN (requires Supabase + development build) ────────────────
export async function signInWithGoogle(): Promise<void> {
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
      throw new Error('Google sign-in is not enabled in your Supabase project.');
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
      'Google sign-in cannot complete in Expo Go.\n\n' +
      'Expo Go does not support the fitnesslevel:// callback scheme.\n\n' +
      'To use Google sign-in, build a development APK:\n  npx expo run:android'
    );
  }
}

// ─── EMAIL SIGN-IN (requires Supabase) ────────────────────────────────────
export async function signInWithEmail(
  email: string,
  password: string,
  createAccount: boolean,
): Promise<boolean> {
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
    try {
      await supabase.auth.signOut();
    } catch {}
  }
  // Clear local guest session
  await clearGuestSession();
  const { clearUser, setAuthUserId, setConsentAcceptedAt } = useStore.getState();
  clearUser();
  setAuthUserId(null);
  setConsentAcceptedAt(null);
}
