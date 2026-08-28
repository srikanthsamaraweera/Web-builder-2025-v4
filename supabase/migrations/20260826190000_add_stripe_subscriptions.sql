-- Stripe subscription linkage and locally cached application entitlements.
alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists subscription_status text,
  add column if not exists stripe_synced_at timestamptz;

create unique index if not exists profiles_stripe_customer_id_key
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists profiles_stripe_subscription_id_key
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- One row per Stripe invoice. The unique invoice ID makes webhook retries safe.
create table if not exists public.subscription_payments (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_invoice_id text not null unique,
  stripe_payment_intent_id text,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  amount_paid bigint not null default 0 check (amount_paid >= 0),
  currency text not null,
  status text not null,
  paid_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscription_payments_user_id_idx
  on public.subscription_payments (user_id);

create index if not exists subscription_payments_customer_id_idx
  on public.subscription_payments (stripe_customer_id);

alter table public.subscription_payments enable row level security;

drop policy if exists "Users can read their subscription payments"
  on public.subscription_payments;

create policy "Users can read their subscription payments"
  on public.subscription_payments
  for select
  to authenticated
  using (user_id = auth.uid());

-- Stripe can redeliver events. Recording their IDs makes processing idempotent.
-- No client policy is intentionally created; service-role server code owns it.
create table if not exists public.stripe_webhook_events (
  id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;
