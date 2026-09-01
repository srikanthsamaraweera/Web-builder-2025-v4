-- Free users may create one private draft. Trialing/paid users retain their
-- configured site limit and may submit sites for publication.

alter table public.profiles
  add column if not exists trial_used_at timestamptz;

drop policy if exists "Public reads approved sites" on public.sites;
drop policy if exists "Public reads approved active sites" on public.sites;

create or replace function public.owner_has_publish_access(owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = owner_id
      and (
        upper(trim(coalesce(role, ''))) = 'ADMIN'
        or (
          lower(coalesce(subscription_status, '')) in ('active', 'trialing', 'past_due')
          and paid_until is not null
          and paid_until > now()
        )
      )
  );
$$;

create policy "Public reads approved active sites"
  on public.sites
  for select
  to anon, authenticated
  using (
    status = 'APPROVED'
    and public.owner_has_publish_access(owner)
  );

create or replace function public.enforce_site_status_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_profile public.profiles%rowtype;
  existing_site_count bigint;
  has_publish_access boolean;
  effective_limit integer;
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

  perform pg_advisory_xact_lock(hashtextextended(new.owner::text, 0));

  select * into owner_profile
  from public.profiles
  where id = new.owner;

  if not found then
    raise exception 'profile_not_found';
  end if;

  has_publish_access :=
    upper(trim(coalesce(owner_profile.role, ''))) = 'ADMIN'
    or (
      lower(coalesce(owner_profile.subscription_status, '')) in ('active', 'trialing', 'past_due')
      and owner_profile.paid_until is not null
      and owner_profile.paid_until > now()
    );

  if new.status = 'SUBMITTED' and not has_publish_access then
    raise exception 'subscription_required_to_publish';
  end if;

  if tg_op = 'INSERT' then
    select count(*) into existing_site_count
    from public.sites
    where owner = new.owner;

    effective_limit := case
      when has_publish_access then greatest(coalesce(owner_profile.site_limit, 0), 1)
      else 1
    end;

    if existing_site_count >= effective_limit then
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
