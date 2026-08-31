create index if not exists site_inquiry_deliveries_created_idx
  on public.site_inquiry_deliveries(created_at);

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
  -- Opportunistic retention cleanup avoids requiring pg_cron. Inquiry records
  -- contain no message content and are retained only for short-term abuse and
  -- delivery troubleshooting.
  delete from public.site_inquiry_deliveries
  where created_at < pg_catalog.now() - interval '7 days';

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
