-- Baseline schema required to rebuild a new Supabase project from backups.
-- Later migrations in this directory add subscription, moderation, inquiry,
-- storage, and security behavior.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'USER',
  created_at timestamptz not null default now(),
  paid_until timestamptz,
  plan_tier text not null default 'BASIC',
  site_limit integer not null default 1 check (site_limit >= 0),
  email text
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  content_json jsonb not null default '{}'::jsonb,
  hero jsonb not null default '[]'::jsonb,
  gallery jsonb not null default '[]'::jsonb,
  status text not null default 'DRAFT',
  published boolean not null default false,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  logo text,
  delete_requested_at timestamptz,
  purge_at timestamptz,
  deleted_at timestamptz,
  delete_reason text,
  nearest_city text,
  constraint sites_slug_key unique (slug),
  constraint sites_status_check check (status in ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'))
);

create index if not exists sites_owner_idx on public.sites(owner);
create index if not exists sites_status_idx on public.sites(status);
create index if not exists sites_purge_at_idx on public.sites(purge_at)
  where purge_at is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_sites_updated_at on public.sites;
create trigger set_sites_updated_at
before update on public.sites
for each row execute function public.set_updated_at();

