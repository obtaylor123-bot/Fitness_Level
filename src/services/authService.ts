import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { requireSupabase, supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export const AUTH_REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: 'fitnesslevel',
  path: 'auth/callback',
});

export async function signInWithGoogle(): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: AUTH_REDIRECT_URI, skipBrowserRedirect: true },
  });
  if (error) {
    if (/provider.*(not enabled|disabled|not configured)|unsupported provider/i.test(error.message)) {
      throw new Error('Google sign-in unavailable. Enable and configure the Google provider in Supabase Auth.');
    }
    throw error;
  }
  if (!data.url) throw new Error('Supabase did not return a Google sign-in URL.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT_URI);
  if (result.type === 'success' && result.url) {
    const { error: exchangeError } = await client.auth.exchangeCodeForSession(result.url);
    if (exchangeError) throw exchangeError;
  } else if (result.type === 'cancel' || result.type === 'dismiss') {
    return;
  } else {
    throw new Error('Google sign-in did not complete. Check the Supabase and Google redirect settings.');
  }
}

export async function signInWithEmail(email: string, password: string, createAccount: boolean): Promise<boolean> {
  const client = requireSupabase();
  const result = createAccount
    ? await client.auth.signUp({ email, password })
    : await client.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  return Boolean(result.data.session);
}

export async function signInAsGuest(): Promise<void> {
  const { error } = await requireSupabase().auth.signInAnonymously();
  if (error) {
    if (/anonymous.*(disabled|not enabled)|not enabled.*anonymous/i.test(error.message)) {
      throw new Error('Guest sign-in is unavailable. Enable anonymous sign-ins in Supabase Auth.');
    }
    throw error;
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
