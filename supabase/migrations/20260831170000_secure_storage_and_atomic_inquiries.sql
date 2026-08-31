-- Keep public website images readable while restricting every write to the
-- owning user's <user-id>/<site-id>/... path (or an administrator).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-assets',
  'site-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists site_assets_select_guard on storage.objects;
drop policy if exists site_assets_insert_guard on storage.objects;
drop policy if exists site_assets_update_guard on storage.objects;
drop policy if exists site_assets_delete_guard on storage.objects;
drop policy if exists site_assets_owner_select on storage.objects;
drop policy if exists site_assets_owner_insert on storage.objects;
drop policy if exists site_assets_owner_update on storage.objects;
drop policy if exists site_assets_owner_delete on storage.objects;

-- Restrictive policies remain effective even if an older broad permissive
-- policy exists. They evaluate to true for other buckets and do not alter them.
create policy site_assets_select_guard
on storage.objects as restrictive
for select to public
using (
  bucket_id <> 'site-assets'
  or (
    auth.role() = 'authenticated'
    and (
      public.is_admin()
      or (
        (storage.foldername(name))[1] = auth.uid()::text
        and exists (
          select 1
          from public.sites s
          where s.id::text = (storage.foldername(name))[2]
            and s.owner = auth.uid()
        )
      )
    )
  )
);

create policy site_assets_insert_guard
on storage.objects as restrictive
for insert to authenticated
with check (
  bucket_id <> 'site-assets'
  or public.is_admin()
  or (
    (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[3] in ('logo', 'logos', 'hero', 'gallery', 'favicon')
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
    and exists (
      select 1
      from public.sites s
      where s.id::text = (storage.foldername(name))[2]
        and s.owner = auth.uid()
    )
  )
);

create policy site_assets_update_guard
on storage.objects as restrictive
for update to authenticated
using (
  bucket_id <> 'site-assets'
  or public.is_admin()
  or (
    (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.sites s
      where s.id::text = (storage.foldername(name))[2]
        and s.owner = auth.uid()
    )
  )
)
with check (
  bucket_id <> 'site-assets'
  or public.is_admin()
  or (
    (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[3] in ('logo', 'logos', 'hero', 'gallery', 'favicon')
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
    and exists (
      select 1 from public.sites s
      where s.id::text = (storage.foldername(name))[2]
        and s.owner = auth.uid()
    )
  )
);

create policy site_assets_delete_guard
on storage.objects as restrictive
for delete to authenticated
using (
  bucket_id <> 'site-assets'
  or public.is_admin()
  or (
    (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.sites s
      where s.id::text = (storage.foldername(name))[2]
        and s.owner = auth.uid()
    )
  )
);

-- These are the permissive policies required by PostgreSQL RLS. The matching
-- restrictive policies above ensure older broad policies cannot bypass them.
create policy site_assets_owner_select
on storage.objects for select to authenticated
using (
  bucket_id = 'site-assets'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] = auth.uid()::text
      and exists (
        select 1 from public.sites s
        where s.id::text = (storage.foldername(name))[2]
          and s.owner = auth.uid()
      )
    )
  )
);

create policy site_assets_owner_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'site-assets'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] = auth.uid()::text
      and (storage.foldername(name))[3] in ('logo', 'logos', 'hero', 'gallery', 'favicon')
      and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
      and exists (
        select 1 from public.sites s
        where s.id::text = (storage.foldername(name))[2]
          and s.owner = auth.uid()
      )
    )
  )
);

create policy site_assets_owner_update
on storage.objects for update to authenticated
using (
  bucket_id = 'site-assets'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] = auth.uid()::text
      and exists (
        select 1 from public.sites s
        where s.id::text = (storage.foldername(name))[2]
          and s.owner = auth.uid()
      )
    )
  )
)
with check (
  bucket_id = 'site-assets'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] = auth.uid()::text
      and (storage.foldername(name))[3] in ('logo', 'logos', 'hero', 'gallery', 'favicon')
      and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
      and exists (
        select 1 from public.sites s
        where s.id::text = (storage.foldername(name))[2]
          and s.owner = auth.uid()
      )
    )
  )
);

create policy site_assets_owner_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'site-assets'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] = auth.uid()::text
      and exists (
        select 1 from public.sites s
        where s.id::text = (storage.foldername(name))[2]
          and s.owner = auth.uid()
      )
    )
  )
);

-- Retain only delivery/rate-limit metadata. Visitor names, addresses, phone
-- numbers, and message contents are sent to the owner and never stored here.
create table if not exists public.site_inquiry_deliveries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  source_hash text not null,
  delivery_status text not null default 'PENDING'
    check (delivery_status in ('PENDING', 'SENT', 'FAILED')),
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_inquiry_deliveries_rate_idx
  on public.site_inquiry_deliveries(site_id, source_hash, created_at desc);

alter table public.site_inquiry_deliveries enable row level security;
revoke all on public.site_inquiry_deliveries from public, anon, authenticated;

-- Serialize requests from the same source/site before reserving a delivery,
-- so simultaneous requests cannot exceed the hourly allowance.
create or replace function public.reserve_site_inquiry_delivery(
  p_site_id uuid,
  p_source_hash text
)
returns table (accepted boolean, reason text, reservation_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_site_id::text || ':' || p_source_hash, 0)
  );

  if not exists (
    select 1 from public.sites s
    where s.id = p_site_id
      and s.status in ('SUBMITTED', 'APPROVED')
  ) then
    return query select false, 'site_not_available'::text, null::uuid;
    return;
  end if;

  if (
    select count(*)
    from public.site_inquiry_deliveries d
    where d.site_id = p_site_id
      and d.source_hash = p_source_hash
      and d.created_at >= pg_catalog.now() - interval '1 hour'
  ) >= 5 then
    return query select false, 'rate_limited'::text, null::uuid;
    return;
  end if;

  insert into public.site_inquiry_deliveries (site_id, source_hash)
  values (p_site_id, p_source_hash)
  returning id into v_reservation_id;

  return query select true, null::text, v_reservation_id;
end;
$$;

revoke all on function public.reserve_site_inquiry_delivery(uuid, text)
from public, anon, authenticated;
grant execute on function public.reserve_site_inquiry_delivery(uuid, text)
to service_role;
