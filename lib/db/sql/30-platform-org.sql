-- The platform organisation — PDT itself.
--
-- WHY THIS EXISTS
--
-- docs/PLATFORM-ADMIN.md: "Staff accounts belong to PDT, not to a customer
-- company." But every tenant-scoped table hangs off organisation_id, and every
-- RLS policy reads that claim from the token. PDT's own people therefore need
-- an organisation to belong to — otherwise each policy grows a null special
-- case, and a bug in any one of them opens a customer's data to staff.
--
-- One flagged row is far cheaper than a nullable tenancy key. The partial
-- unique index in the schema guarantees there is never more than one.
--
-- Idempotent: safe to run as often as you like.

insert into public.organisations (slug, name, is_platform, is_active)
values ('profil-design-trading', 'Profil Design Trading', true, true)
on conflict (slug) do update
  set is_platform = true,
      name = excluded.name,
      updated_at = now();
