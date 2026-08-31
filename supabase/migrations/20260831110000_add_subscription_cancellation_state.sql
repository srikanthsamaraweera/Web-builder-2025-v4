alter table public.profiles
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists subscription_cancel_at timestamptz;

