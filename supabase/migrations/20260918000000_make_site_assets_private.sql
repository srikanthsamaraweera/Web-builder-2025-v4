-- Unreviewed user uploads must not have permanent public object URLs.
-- The application supplies short-lived signed URLs only after its preview
-- endpoint has authorized the viewer (owner/admin or active shared site).
update storage.buckets
set public = false
where id = 'site-assets';

-- Preserve the existing owner/admin RLS policies. A private bucket applies
-- them to downloads as well as writes; server-side service-role signing is
-- used for authorized public previews.
