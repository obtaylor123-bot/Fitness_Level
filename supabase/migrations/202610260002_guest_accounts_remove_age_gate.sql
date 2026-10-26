-- Guest authentication is supported; provider values reflect all supported login methods.
alter table public.user_profiles
  drop constraint if exists user_profiles_auth_provider_check;

alter table public.user_profiles
  add constraint user_profiles_auth_provider_check
  check (auth_provider in ('google', 'email', 'guest'));

-- Age attestation is no longer collected, so remove its stored value from existing records.
alter table public.user_consents
  drop column if exists minimum_age;
