-- Personal workout and profile records are private to the authenticated Supabase user.
create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  goal text not null default 'general' check (goal in ('strength', 'cardio', 'mobility', 'general')),
  equipment_available jsonb not null default '["bodyweight"]'::jsonb,
  experience_level text not null default 'beginner' check (experience_level in ('beginner', 'intermediate', 'expert')),
  current_xp integer not null default 0 check (current_xp >= 0),
  current_level integer not null default 1 check (current_level >= 1),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  join_date timestamptz not null default now(),
  notification_time text not null default '08:00' check (notification_time ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  notifications_enabled boolean not null default false,
  current_weight numeric(7,2) check (current_weight is null or current_weight > 0),
  target_weight numeric(7,2) check (target_weight is null or target_weight > 0),
  weight_unit text not null default 'lbs' check (weight_unit in ('lbs', 'kg')),
  email text,
  display_name text,
  photo_url text,
  auth_provider text not null default 'email' check (auth_provider in ('google', 'email')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_sets (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  exercises jsonb not null default '[]'::jsonb,
  total_xp_available integer not null default 0 check (total_xp_available >= 0),
  total_xp_earned integer not null default 0 check (total_xp_earned >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.xp_transactions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount >= 0),
  source text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_consents (
  user_id uuid primary key references auth.users (id) on delete cascade,
  accepted_at timestamptz not null,
  minimum_age smallint not null default 13 check (minimum_age >= 13),
  policy_version text not null,
  terms_version text not null
);

create index if not exists daily_sets_user_date_idx on public.daily_sets (user_id, date desc);
create index if not exists xp_transactions_user_created_idx on public.xp_transactions (user_id, created_at desc);

alter table public.user_profiles enable row level security;
alter table public.daily_sets enable row level security;
alter table public.xp_transactions enable row level security;
alter table public.user_consents enable row level security;

revoke all on table public.user_profiles, public.daily_sets, public.xp_transactions, public.user_consents from anon, authenticated;
grant select, insert, update, delete on table public.user_profiles, public.daily_sets, public.xp_transactions, public.user_consents to authenticated;

create policy "users manage own profile" on public.user_profiles
  for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "users manage own daily sets" on public.daily_sets
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "users manage own xp" on public.xp_transactions
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "users manage own consent" on public.user_consents
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- The anonymous API role receives no table grants; rows require a verified user session.
