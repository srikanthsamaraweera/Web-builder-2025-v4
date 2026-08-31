-- The email-only inquiry flow uses public.site_inquiry_deliveries, which stores
-- only short-lived delivery/rate-limit metadata. The former table is empty and
-- is no longer referenced by the application.
drop function if exists public.submit_site_inquiry(uuid, text, text, text, text, text);
drop table if exists public.site_inquiries;
