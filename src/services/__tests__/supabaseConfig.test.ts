jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({})) }));

describe('Supabase configuration guard', () => {
  const oldUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  afterEach(() => {
    if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldKey;
    jest.resetModules();
  });

  it('shows a clear configuration error and cannot fall through to fake sign-in', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = '';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = '';
    jest.resetModules();

    const { isSupabaseConfigured, requireSupabase } = require('../supabase') as typeof import('../supabase');
    expect(isSupabaseConfigured).toBe(false);
    expect(requireSupabase).toThrow(/Supabase URL and publishable key/);
  });
});
