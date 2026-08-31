create table if not exists public.site_inquiries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 320),
  phone text,
  message text not null check (char_length(message) between 1 and 3000),
  source_hash text,
  status text not null default 'NEW' check (status in ('NEW', 'READ', 'ARCHIVED')),
  created_at timestamptz not null default now()
);

create index if not exists site_inquiries_site_created_idx
  on public.site_inquiries(site_id, created_at desc);

create index if not exists site_inquiries_rate_limit_idx
  on public.site_inquiries(site_id, source_hash, created_at desc);

alter table public.site_inquiries enable row level security;
