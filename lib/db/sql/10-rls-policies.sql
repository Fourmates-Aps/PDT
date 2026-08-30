-- Row-Level Security policies.
--
-- WHY THESE LIVE IN SQL RATHER THAN IN THE DRIZZLE SCHEMA
--
-- `drizzle-kit push` creates policy OBJECTS but does not emit their USING /
-- WITH CHECK expressions. A policy created that way has no predicate, and a
-- predicate-less policy in Postgres permits every row — so pushing pgPolicy()
-- declarations produced eleven tables with RLS "enabled" and zero isolation.
--
-- `drizzle-kit generate` does emit them, but this project applies schema with
-- push, so the policies are defined here instead and applied by `npm run db:bootstrap`.
-- This file is the single source of truth for authorisation. The Drizzle schema
-- only turns RLS on (.enableRLS()).
--
-- Every statement is idempotent: run it as often as you like.
--
-- Depends on 00-auth-helpers.sql.

-- ===========================================================================
-- organisations
-- ===========================================================================
drop policy if exists organisations_select_own on public.organisations;
create policy organisations_select_own on public.organisations
  for select to authenticated
  using (id = public.auth_org_id());

drop policy if exists organisations_admin_all on public.organisations;
create policy organisations_admin_all on public.organisations
  for all to authenticated
  using (public.auth_user_role() = 'admin')
  with check (public.auth_user_role() = 'admin');

-- ===========================================================================
-- departments
-- ===========================================================================
drop policy if exists departments_select_own_org on public.departments;
create policy departments_select_own_org on public.departments
  for select to authenticated
  using (organisation_id = public.auth_org_id());

drop policy if exists departments_manage on public.departments;
create policy departments_manage on public.departments
  for all to authenticated
  using (
    organisation_id = public.auth_org_id()
    and public.auth_user_role() in ('customer_admin', 'admin')
  )
  with check (
    organisation_id = public.auth_org_id()
    and public.auth_user_role() in ('customer_admin', 'admin')
  );

-- ===========================================================================
-- organisation_members
-- ===========================================================================
drop policy if exists organisation_members_select_own_org on public.organisation_members;
create policy organisation_members_select_own_org on public.organisation_members
  for select to authenticated
  using (organisation_id = public.auth_org_id());

drop policy if exists organisation_members_manage on public.organisation_members;
create policy organisation_members_manage on public.organisation_members
  for all to authenticated
  using (
    organisation_id = public.auth_org_id()
    and public.auth_user_role() in ('customer_admin', 'admin')
  )
  with check (
    organisation_id = public.auth_org_id()
    and public.auth_user_role() in ('customer_admin', 'admin')
  );

-- ===========================================================================
-- products / product_variants — shared supplier master data.
-- Readable by any signed-in user; writable only by platform staff.
-- Per-tenant visibility is enforced through org_assortment, not here.
-- ===========================================================================
drop policy if exists products_select_authenticated on public.products;
create policy products_select_authenticated on public.products
  for select to authenticated
  using (true);

drop policy if exists products_admin_write on public.products;
create policy products_admin_write on public.products
  for all to authenticated
  using (public.auth_user_role() = 'admin')
  with check (public.auth_user_role() = 'admin');

drop policy if exists product_variants_select_authenticated on public.product_variants;
create policy product_variants_select_authenticated on public.product_variants
  for select to authenticated
  using (true);

drop policy if exists product_variants_admin_write on public.product_variants;
create policy product_variants_admin_write on public.product_variants
  for all to authenticated
  using (public.auth_user_role() = 'admin')
  with check (public.auth_user_role() = 'admin');

-- ===========================================================================
-- org_assortment
-- ===========================================================================
drop policy if exists org_assortment_select_own_org on public.org_assortment;
create policy org_assortment_select_own_org on public.org_assortment
  for select to authenticated
  using (organisation_id = public.auth_org_id());

drop policy if exists org_assortment_manage on public.org_assortment;
create policy org_assortment_manage on public.org_assortment
  for all to authenticated
  using (
    organisation_id = public.auth_org_id()
    and public.auth_user_role() in ('customer_admin', 'admin')
  )
  with check (
    organisation_id = public.auth_org_id()
    and public.auth_user_role() in ('customer_admin', 'admin')
  );

-- ===========================================================================
-- org_pricing — employees may read their org's prices, only platform staff set them.
-- ===========================================================================
drop policy if exists org_pricing_select_own_org on public.org_pricing;
create policy org_pricing_select_own_org on public.org_pricing
  for select to authenticated
  using (organisation_id = public.auth_org_id());

drop policy if exists org_pricing_manage on public.org_pricing;
create policy org_pricing_manage on public.org_pricing
  for all to authenticated
  using (
    organisation_id = public.auth_org_id()
    and public.auth_user_role() = 'admin'
  )
  with check (
    organisation_id = public.auth_org_id()
    and public.auth_user_role() = 'admin'
  );

-- ===========================================================================
-- employee_quotas — an employee sees their own balance and cannot raise it.
-- ===========================================================================
drop policy if exists employee_quotas_select on public.employee_quotas;
create policy employee_quotas_select on public.employee_quotas
  for select to authenticated
  using (
    organisation_id = public.auth_org_id()
    and (
      public.auth_user_role() in ('customer_admin', 'admin')
      or member_id in (
        select id from public.organisation_members
        where user_id = auth.uid() and organisation_id = public.auth_org_id()
      )
    )
  );

drop policy if exists employee_quotas_manage on public.employee_quotas;
create policy employee_quotas_manage on public.employee_quotas
  for all to authenticated
  using (
    organisation_id = public.auth_org_id()
    and public.auth_user_role() in ('customer_admin', 'admin')
  )
  with check (
    organisation_id = public.auth_org_id()
    and public.auth_user_role() in ('customer_admin', 'admin')
  );

-- ===========================================================================
-- orders
-- ===========================================================================
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders
  for select to authenticated
  using (
    organisation_id = public.auth_org_id()
    and (
      public.auth_user_role() in ('customer_admin', 'admin', 'warehouse', 'key_account_manager')
      or member_id in (
        select id from public.organisation_members
        where user_id = auth.uid() and organisation_id = public.auth_org_id()
      )
    )
  );

-- An order may only be placed against the caller's own membership. Without this,
-- an employee could spend a colleague's clothing budget.
drop policy if exists orders_insert_own on public.orders;
create policy orders_insert_own on public.orders
  for insert to authenticated
  with check (
    organisation_id = public.auth_org_id()
    and member_id in (
      select id from public.organisation_members
      where user_id = auth.uid() and organisation_id = public.auth_org_id()
    )
  );

drop policy if exists orders_update_elevated on public.orders;
create policy orders_update_elevated on public.orders
  for update to authenticated
  using (
    organisation_id = public.auth_org_id()
    and public.auth_user_role() in ('customer_admin', 'admin', 'warehouse', 'key_account_manager')
  )
  with check (organisation_id = public.auth_org_id());

-- ===========================================================================
-- order_lines
-- ===========================================================================
drop policy if exists order_lines_select on public.order_lines;
create policy order_lines_select on public.order_lines
  for select to authenticated
  using (
    organisation_id = public.auth_org_id()
    and order_id in (select id from public.orders where organisation_id = public.auth_org_id())
  );

drop policy if exists order_lines_write on public.order_lines;
create policy order_lines_write on public.order_lines
  for all to authenticated
  using (organisation_id = public.auth_org_id())
  with check (
    organisation_id = public.auth_org_id()
    and order_id in (select id from public.orders where organisation_id = public.auth_org_id())
  );

-- ===========================================================================
-- approval_requests
-- ===========================================================================
drop policy if exists approval_requests_select on public.approval_requests;
create policy approval_requests_select on public.approval_requests
  for select to authenticated
  using (
    organisation_id = public.auth_org_id()
    and (
      public.auth_user_role() in ('customer_admin', 'admin')
      or requested_by in (
        select id from public.organisation_members
        where user_id = auth.uid() and organisation_id = public.auth_org_id()
      )
    )
  );

drop policy if exists approval_requests_insert on public.approval_requests;
create policy approval_requests_insert on public.approval_requests
  for insert to authenticated
  with check (
    organisation_id = public.auth_org_id()
    and requested_by in (
      select id from public.organisation_members
      where user_id = auth.uid() and organisation_id = public.auth_org_id()
    )
  );

-- An approver may not approve their own request.
drop policy if exists approval_requests_decide on public.approval_requests;
create policy approval_requests_decide on public.approval_requests
  for update to authenticated
  using (
    organisation_id = public.auth_org_id()
    and public.auth_user_role() in ('customer_admin', 'admin')
    and requested_by not in (
      select id from public.organisation_members
      where user_id = auth.uid() and organisation_id = public.auth_org_id()
    )
  )
  with check (
    organisation_id = public.auth_org_id()
    and public.auth_user_role() in ('customer_admin', 'admin')
  );

-- ===========================================================================
-- suppliers / supplier_orders / supplier_order_lines
--
-- PDT's OWN purchasing. These tables carry no organisation_id, so the tenant
-- predicate used everywhere above does not apply — instead they are closed to
-- customers entirely. A customer must never see what PDT pays a supplier, nor
-- that their order is being pooled with a competitor's to reach a minimum.
--
-- Warehouse staff read (they receive the goods); only platform admins write.
-- ===========================================================================
drop policy if exists suppliers_staff_read on public.suppliers;
create policy suppliers_staff_read on public.suppliers
  for select to authenticated
  using (public.auth_user_role() in ('admin', 'warehouse'));

drop policy if exists suppliers_admin_write on public.suppliers;
create policy suppliers_admin_write on public.suppliers
  for all to authenticated
  using (public.auth_user_role() = 'admin')
  with check (public.auth_user_role() = 'admin');

drop policy if exists supplier_orders_staff_read on public.supplier_orders;
create policy supplier_orders_staff_read on public.supplier_orders
  for select to authenticated
  using (public.auth_user_role() in ('admin', 'warehouse'));

drop policy if exists supplier_orders_admin_write on public.supplier_orders;
create policy supplier_orders_admin_write on public.supplier_orders
  for all to authenticated
  using (public.auth_user_role() = 'admin')
  with check (public.auth_user_role() = 'admin');

drop policy if exists supplier_order_lines_staff_read on public.supplier_order_lines;
create policy supplier_order_lines_staff_read on public.supplier_order_lines
  for select to authenticated
  using (public.auth_user_role() in ('admin', 'warehouse'));

drop policy if exists supplier_order_lines_admin_write on public.supplier_order_lines;
create policy supplier_order_lines_admin_write on public.supplier_order_lines
  for all to authenticated
  using (public.auth_user_role() = 'admin')
  with check (public.auth_user_role() = 'admin');

-- ===========================================================================
-- audit_log
--
-- Read-only to platform admins, and DELIBERATELY NOTHING ELSE.
--
-- With no INSERT, UPDATE or DELETE policy, Postgres denies all three to every
-- authenticated client — which is what makes the table append-only from the
-- outside. Server-side writes go through Drizzle, which connects as the owner
-- and bypasses RLS. An audit trail an actor can edit is not an audit trail.
-- ===========================================================================
drop policy if exists audit_log_admin_read on public.audit_log;
create policy audit_log_admin_read on public.audit_log
  for select to authenticated
  using (public.auth_user_role() = 'admin');

-- ===========================================================================
-- b2b_applications
--
-- Inbound sales data. Readable by the people who act on it — platform admins
-- and KAMs — and writable from the browser by NOBODY.
--
-- The public form does not insert through a client: it posts to
-- /api/enquiries, which writes through Drizzle as the database owner and so
-- bypasses RLS entirely. That is deliberate. Granting anon INSERT here would
-- make the table writable by anyone who can find the Supabase anon key, with
-- no rate limit, no validation and no honeypot in front of it.
-- ===========================================================================
drop policy if exists b2b_applications_staff_read on public.b2b_applications;
create policy b2b_applications_staff_read on public.b2b_applications
  for select to authenticated
  using (public.auth_user_role() in ('admin', 'key_account_manager'));

-- Only a platform admin may move an application through review. A KAM can see
-- the queue but not decide it — Q-A3b (who approves) is still open, and the
-- narrower rule is the one that is safe to widen later.
drop policy if exists b2b_applications_admin_write on public.b2b_applications;
create policy b2b_applications_admin_write on public.b2b_applications
  for update to authenticated
  using (public.auth_user_role() = 'admin')
  with check (public.auth_user_role() = 'admin');

-- ===========================================================================
-- enquiries
--
-- Same shape: staff read, nobody writes from a client. No DELETE policy either
-- — an enquiry is answered by setting handled_at, not by making it disappear.
-- ===========================================================================
drop policy if exists enquiries_staff_read on public.enquiries;
create policy enquiries_staff_read on public.enquiries
  for select to authenticated
  using (public.auth_user_role() in ('admin', 'key_account_manager'));

drop policy if exists enquiries_staff_handle on public.enquiries;
create policy enquiries_staff_handle on public.enquiries
  for update to authenticated
  using (public.auth_user_role() in ('admin', 'key_account_manager'))
  with check (public.auth_user_role() in ('admin', 'key_account_manager'));

-- ===========================================================================
-- rate_limits
--
-- NO POLICIES AT ALL, on purpose.
--
-- RLS is enabled and nothing is granted, so every authenticated client is
-- denied SELECT, INSERT, UPDATE and DELETE. Only the owner connection touches
-- it. A rate-limit counter a client can read tells an attacker exactly how much
-- budget they have left; one a client can write is not a rate limit.
-- ===========================================================================

-- ===========================================================================
-- import_runs / import_changes
--
-- Supplier feed data, including dealer cost prices in the staged `before`/
-- `after` payloads. Platform staff read it; nobody writes it from a browser.
--
-- The importer runs as the database owner and bypasses RLS, which is why there
-- is no INSERT policy: a catalogue that a client could write to is a catalogue
-- anyone with the anon key could rewrite.
-- ===========================================================================
drop policy if exists import_runs_staff_read on public.import_runs;
create policy import_runs_staff_read on public.import_runs
  for select to authenticated
  using (public.auth_user_role() in ('admin', 'key_account_manager'));

-- Approving or rejecting a catalogue replacement is an admin decision. A KAM
-- can watch the queue; only an admin changes what the shop sells.
drop policy if exists import_runs_admin_decide on public.import_runs;
create policy import_runs_admin_decide on public.import_runs
  for update to authenticated
  using (public.auth_user_role() = 'admin')
  with check (public.auth_user_role() = 'admin');

drop policy if exists import_changes_staff_read on public.import_changes;
create policy import_changes_staff_read on public.import_changes
  for select to authenticated
  using (public.auth_user_role() in ('admin', 'key_account_manager'));
