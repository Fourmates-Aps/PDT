-- Claim accessors used by every RLS policy.
--
-- Two deliberate deviations from DEV_BRIEF_IMPLEMENTATION_PLAN.md §3:
--
--  1. These live in `public`, not `auth`. Supabase owns the `auth` schema and can
--     rewrite it during platform upgrades; objects we add there are liable to be
--     clobbered and are not covered by our own backups of `public`.
--
--  2. They are plain STABLE functions, not SECURITY DEFINER. They only read the
--     request's own JWT and touch no tables, so running them as the definer would
--     grant privilege for no reason. Least privilege by default.
--
-- Both return NULL when the claim is absent, which makes every `= public.auth_org_id()`
-- comparison evaluate to NULL — and therefore deny — for unauthenticated requests.

create or replace function public.auth_org_id()
  returns uuid
  language sql
  stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'organisation_id', '')::uuid;
$$;

create or replace function public.auth_user_role()
  returns text
  language sql
  stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'role', '');
$$;

comment on function public.auth_org_id() is
  'Organisation id from the caller''s JWT app_metadata. NULL when unauthenticated.';
comment on function public.auth_user_role() is
  'Role from the caller''s JWT app_metadata. NULL when unauthenticated.';

grant execute on function public.auth_org_id() to anon, authenticated, service_role;
grant execute on function public.auth_user_role() to anon, authenticated, service_role;
