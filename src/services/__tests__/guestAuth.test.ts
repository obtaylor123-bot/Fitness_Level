jest.mock('expo-auth-session', () => ({ makeRedirectUri: jest.fn(() => 'fitnesslevel://auth/callback') }));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('../supabase', () => ({ requireSupabase: jest.fn(), supabase: { auth: { signOut: jest.fn() } } }));

import { requireSupabase } from '../supabase';
import { signInAsGuest } from '../authService';

describe('guest authentication', () => {
  const signInAnonymously = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (requireSupabase as jest.Mock).mockReturnValue({ auth: { signInAnonymously } });
  });

  it('creates an anonymous Supabase account', async () => {
    signInAnonymously.mockResolvedValue({ error: null });
    await expect(signInAsGuest()).resolves.toBeUndefined();
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('surfaces a clear failure from Supabase', async () => {
    const error = new Error('anonymous sign-in disabled');
    signInAnonymously.mockResolvedValue({ error });
    await expect(signInAsGuest()).rejects.toThrow('Guest sign-in is unavailable. Enable anonymous sign-ins in Supabase Auth.');
  });
});
