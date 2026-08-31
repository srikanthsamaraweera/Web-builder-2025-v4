alter table public.site_inquiries
  add column if not exists source_hash text;

create index if not exists site_inquiries_rate_limit_idx
  on public.site_inquiries(site_id, source_hash, created_at desc);
