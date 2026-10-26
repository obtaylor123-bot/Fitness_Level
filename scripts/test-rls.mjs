import { createClient } from '@supabase/supabase-js';

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'RLS_TEST_USER_A_EMAIL', 'RLS_TEST_USER_A_PASSWORD', 'RLS_TEST_USER_B_EMAIL', 'RLS_TEST_USER_B_PASSWORD'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing ${key}. Use two disposable local Supabase test accounts; no service-role key is used.`);
    process.exit(2);
  }
}

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const authOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const userA = createClient(url, anonKey, authOptions);
const userB = createClient(url, anonKey, authOptions);
const anonymous = createClient(url, anonKey, authOptions);
const tables = ['user_profiles', 'user_consents', 'daily_sets', 'xp_transactions'];
const uuid = () => crypto.randomUUID();
const checks = [];
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  checks.push(message);
};

const signIn = async (client, email, password) => {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error('Could not sign in a test account.');
  return data.user;
};

let idA;
let idB;
const fixture = { profile: false, consent: false, dailyId: uuid(), xpId: uuid() };
try {
  const [a, b] = await Promise.all([
    signIn(userA, process.env.RLS_TEST_USER_A_EMAIL, process.env.RLS_TEST_USER_A_PASSWORD),
    signIn(userB, process.env.RLS_TEST_USER_B_EMAIL, process.env.RLS_TEST_USER_B_PASSWORD),
  ]);
  idA = a.id;
  idB = b.id;
  assert(idA !== idB, 'Test users have distinct authenticated IDs');

  const forbiddenInserts = [
    ['user_profiles', { id: idB, goal: 'general', equipment_available: ['bodyweight'], experience_level: 'beginner', auth_provider: 'email' }],
    ['user_consents', { user_id: idB, accepted_at: new Date().toISOString(), policy_version: 'rls-test', terms_version: 'rls-test' }],
    ['daily_sets', { id: uuid(), user_id: idB, date: '9999-12-31', exercises: [], total_xp_available: 0, total_xp_earned: 0 }],
    ['xp_transactions', { id: uuid(), user_id: idB, amount: 1, source: 'rls-test' }],
  ];
  for (const [table, row] of forbiddenInserts) {
    const { error } = await userA.from(table).insert(row);
    assert(Boolean(error), `${table}: cross-user INSERT is denied`);
  }

  const profile = await userB.from('user_profiles').insert({
    id: idB, goal: 'general', equipment_available: ['bodyweight'], experience_level: 'beginner', auth_provider: 'email',
  });
  if (profile.error) throw new Error('Could not create user B test profile; use a disposable account with no profile.');
  fixture.profile = true;
  const consent = await userB.from('user_consents').insert({
    user_id: idB, accepted_at: new Date().toISOString(), policy_version: 'rls-test', terms_version: 'rls-test',
  });
  if (consent.error) throw new Error('Could not create user B test consent; use a disposable account with no consent row.');
  fixture.consent = true;
  const daily = await userB.from('daily_sets').insert({
    id: fixture.dailyId, user_id: idB, date: '9999-12-31', exercises: [], total_xp_available: 0, total_xp_earned: 0,
  });
  if (daily.error) throw new Error('Could not create the daily_sets RLS fixture.');
  const xp = await userB.from('xp_transactions').insert({ id: fixture.xpId, user_id: idB, amount: 1, source: 'rls-test' });
  if (xp.error) throw new Error('Could not create the xp_transactions RLS fixture.');

  const keyAndValue = {
    user_profiles: ['id', idB, { current_xp: 1 }],
    user_consents: ['user_id', idB, { policy_version: 'rls-test-updated' }],
    daily_sets: ['id', fixture.dailyId, { total_xp_earned: 1 }],
    xp_transactions: ['id', fixture.xpId, { amount: 2 }],
  };
  for (const table of tables) {
    const [key, value, change] = keyAndValue[table];
    const { data: read, error: readError } = await userA.from(table).select('*').eq(key, value);
    assert(!readError && (read?.length ?? 0) === 0, `${table}: cross-user SELECT returns no rows`);
    const { data: updated, error: updateError } = await userA.from(table).update(change).eq(key, value).select(key);
    assert(!updateError && (updated?.length ?? 0) === 0, `${table}: cross-user UPDATE affects no rows`);
    const { data: deleted, error: deleteError } = await userA.from(table).delete().eq(key, value).select(key);
    assert(!deleteError && (deleted?.length ?? 0) === 0, `${table}: cross-user DELETE affects no rows`);
  }

  for (const table of tables) {
    const { data, error } = await anonymous.from(table).select('*').limit(1);
    assert(Boolean(error) || (data?.length ?? 0) === 0, `${table}: unauthenticated SELECT returns no rows`);
  }
} finally {
  if (idB) {
    await userB.from('xp_transactions').delete().eq('id', fixture.xpId);
    await userB.from('daily_sets').delete().eq('id', fixture.dailyId);
    if (fixture.consent) await userB.from('user_consents').delete().eq('user_id', idB);
    if (fixture.profile) await userB.from('user_profiles').delete().eq('id', idB);
  }
  await Promise.all([userA.auth.signOut(), userB.auth.signOut()]);
}

console.log(`Passed ${checks.length} RLS assertions across four user-data tables.`);
