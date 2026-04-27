-- Prevent non-admin site owners from bypassing the UI and self-approving sites.
-- Admin users and service-role server code may set any status.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'ADMIN'
  );
$$;

create or replace function public.enforce_site_status_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if new.owner is distinct from auth.uid() then
    raise exception 'site_owner_mismatch';
  end if;

  if tg_op = 'UPDATE' and old.owner is distinct from new.owner then
    raise exception 'site_owner_immutable';
  end if;

  if coalesce(new.status, 'DRAFT') not in ('DRAFT', 'SUBMITTED') then
    raise exception 'site_status_not_allowed';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_site_status_permissions on public.sites;

create trigger enforce_site_status_permissions
before insert or update on public.sites
for each row
execute function public.enforce_site_status_permissions();
