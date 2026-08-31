-- Browser users may read profile data they are authorized to see, but all
-- profile mutations (roles, Stripe IDs, entitlements) are server-owned.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'ADMIN'
  );
$$;

alter table public.profiles enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format(
      'drop policy if exists %I on public.profiles',
      policy_record.policyname
    );
  end loop;
end
$$;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

create policy "Users read their own profile and admins read all profiles"
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) or public.is_admin());

-- Rebuild the sites policies so browser access is explicitly owner-scoped.
-- Public visitors may query approved directory listings only. Submitted pages
-- remain available through the validated server preview endpoint.

alter table public.sites enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'sites'
  loop
    execute format(
      'drop policy if exists %I on public.sites',
      policy_record.policyname
    );
  end loop;
end
$$;

revoke all on table public.sites from anon, authenticated;
grant select on table public.sites to anon, authenticated;
grant insert, update, delete on table public.sites to authenticated;

create policy "Public reads approved sites"
  on public.sites
  for select
  to anon, authenticated
  using (status = 'APPROVED');

create policy "Owners and admins read managed sites"
  on public.sites
  for select
  to authenticated
  using (owner = (select auth.uid()) or public.is_admin());

create policy "Owners insert sites"
  on public.sites
  for insert
  to authenticated
  with check (owner = (select auth.uid()));

create policy "Owners and admins update sites"
  on public.sites
  for update
  to authenticated
  using (owner = (select auth.uid()) or public.is_admin())
  with check (owner = (select auth.uid()) or public.is_admin());

create policy "Owners and admins delete sites"
  on public.sites
  for delete
  to authenticated
  using (owner = (select auth.uid()) or public.is_admin());

-- Serialize site creation per owner, then enforce subscription status, expiry,
-- and site count inside the database. This cannot be bypassed by calling the
-- Supabase Data API directly.

create or replace function public.enforce_site_status_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_profile public.profiles%rowtype;
  existing_site_count bigint;
  requires_entitlement_check boolean;
begin
  if (select auth.role()) = 'service_role' or public.is_admin() then
    return new;
  end if;

  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;

  if new.owner is distinct from (select auth.uid()) then
    raise exception 'site_owner_mismatch';
  end if;

  if tg_op = 'UPDATE' and old.owner is distinct from new.owner then
    raise exception 'site_owner_immutable';
  end if;

  if coalesce(new.status, 'DRAFT') not in ('DRAFT', 'SUBMITTED') then
    raise exception 'site_status_not_allowed';
  end if;

  requires_entitlement_check :=
    tg_op = 'INSERT'
    or (
      tg_op = 'UPDATE'
      and coalesce(old.status, 'DRAFT') <> 'SUBMITTED'
      and new.status = 'SUBMITTED'
    );

  if not requires_entitlement_check then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.owner::text, 0));

  select *
  into owner_profile
  from public.profiles
  where id = new.owner;

  if not found then
    raise exception 'profile_not_found';
  end if;

  if lower(coalesce(owner_profile.subscription_status, ''))
      not in ('active', 'trialing', 'past_due')
    or owner_profile.paid_until is null
    or owner_profile.paid_until <= now()
  then
    raise exception 'subscription_inactive';
  end if;

  if tg_op = 'INSERT' then
    select count(*)
    into existing_site_count
    from public.sites
    where owner = new.owner;

    if existing_site_count >= greatest(coalesce(owner_profile.site_limit, 0), 0) then
      raise exception 'site_limit_reached';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_site_status_permissions on public.sites;

create trigger enforce_site_status_permissions
before insert or update on public.sites
for each row
execute function public.enforce_site_status_permissions();

