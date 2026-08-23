# Profil Design Trading — Technical Implementation Plan

> **Authority:** This document translates the Dev Brief (Rasmus/Rune, Aug 2026), the prototype analysis, PRD, and supplier documentation into a concrete build plan. Read the Dev Brief first. Read the prototype (`ProfilDesignTrading_Platform.html`) before coding any screen. Read this before writing any code.

**Fixed-price delivery deadline: 31 January 2027**
**Repo:** `Rasmuscort/` (private GitHub)
**Stack:** Next.js → Vercel · Supabase (Postgres + Auth + Storage) · Higgsfield/Wavespeed AI

---

## Table of Contents

1. [Non-Negotiable Foundations](#1-non-negotiable-foundations)
2. [Multi-Tenant Database Schema](#2-multi-tenant-database-schema)
3. [Row-Level Security (RLS) Policies](#3-row-level-security-rls-policies)
4. [Authentication & Role System](#4-authentication--role-system)
5. [Phase 1 — Webshop & Order Flow](#5-phase-1--webshop--order-flow)
6. [Phase 2 — AI Fitting Room, Pricing & Brand Library](#6-phase-2--ai-fitting-room-pricing--brand-library)
7. [Phase 3 — Proofing, Production & Warehouse](#7-phase-3--proofing-production--warehouse)
8. [Phase 4 — Integrations, Economy, CRM & Analytics](#8-phase-4--integrations-economy-crm--analytics)
9. [Supplier Integration Layer](#9-supplier-integration-layer)
10. [CI/CD & Repository Conventions](#10-cicd--repository-conventions)
11. [Open Questions (Kickoff)](#11-open-questions-kickoff)

---

## 1. Non-Negotiable Foundations

These must be correct in Phase 1. Getting them wrong makes Phases 2–4 a full rewrite. Commit nothing to main before each is reviewed by Rasmus.

### 1.1 Multi-Tenancy — `organisation_id` Everywhere

Every table except system-level lookup tables (`countries`, `sizes`, `supplier_meta`) **must** have an `organisation_id UUID NOT NULL REFERENCES organisations(id)`. This is enforced via:

1. Postgres `DEFAULT` that injects the current org from the auth context.
2. RLS policy that blocks cross-org reads/writes.
3. Application-level middleware that sets `app.organisation_id` on the connection.

> **Rule:** If a PR adds a table without `organisation_id`, it must not be merged.

### 1.2 Auth First, Never Bolt-On

Phase 1 ships with five roles hardened in Supabase Auth from commit one:

| Role slug | What they can do |
|---|---|
| `employee` | Browse org assortment, add to cart, checkout, view own orders |
| `customer_admin` | Manage employees, departments, budgets, approve orders |
| `key_account_manager` | Onboard customers, manage pipeline, no financial data |
| `warehouse` | Pack & ship queue, stock management only |
| `admin` | Everything — multi-tenant platform admin |

Roles are stored in `auth.users` `app_metadata.role`. Never in `localStorage`. Never in the URL.

### 1.3 Integrations as a Swappable Module Layer

Finance (e-conomic) and supplier feeds are a separate `lib/integrations/` directory. Business logic **never** calls e-conomic directly — it calls `IntegrationService.postInvoice(...)` which routes to the e-conomic adapter. This makes it replaceable without touching order logic.

```
lib/
  integrations/
    economic/          # e-conomic REST adapter
    suppliers/
      fh-you/          # F&H/You CSV feed adapter
      teejays/         # SFTP adapter
      fristads/        # FTP adapter
      mascot/          # FTP + EDIFACT adapter
      engel/           # FTP nightly adapter
      nwg/             # GraphQL adapter
      id-identity/     # Download Manager adapter
      nimbus/          # XML feed adapter
      pfconcept/       # JSON Gateway adapter
      snickers/        # Portal + EDI adapter (semi-manual)
    shipping/
      gls/             # Label generation + track & trace
      postnord/
    payment/
      mobilepay/       # Signed webhook, idempotency key required
```

### 1.4 AI Usage Tracking — From Commit One

Every call to Higgsfield/Wavespeed **must** write a row to `ai_generation_log` before the HTTP call returns. This cannot be retrofitted from logs — it is the billing source for future per-tenant licensing.

```sql
CREATE TABLE ai_generation_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  product_sku     TEXT NOT NULL,
  logo_asset_id   UUID REFERENCES brand_assets(id),
  placement       TEXT NOT NULL,  -- 'chest_left', 'back', 'sleeve_left', etc.
  provider        TEXT NOT NULL,  -- 'higgsfield' | 'wavespeed'
  cost_dkk        NUMERIC(8,4),   -- target <= 0.50 DKK per generation
  cache_hit       BOOLEAN NOT NULL DEFAULT false,
  result_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.5 AI Generation Cache & Rate Limiting

Cache key: `SHA256(product_sku + logo_asset_id + placement + method)`.

* Cache result in Supabase Storage under `ai-generations/` with the SHA key as filename.
* Before each generation call, check cache. Return cached URL if hit (set `cache_hit = true` in log).
* Rate limit: max 10 generations per user per rolling 60 minutes. Return HTTP 429 with `Retry-After`.
* The cache is what protects the fixed-price margin — enforce it from day one.

---

## 2. Multi-Tenant Database Schema

> Review this with Rasmus before writing a single migration. The schema is expensive to change.

### 2.1 Core Tables

```sql
-- ============================================================
-- TENANCY ROOT
-- ============================================================
CREATE TABLE organisations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  cvr             TEXT,
  ean             TEXT,
  contact_name    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  address_line1   TEXT,
  address_line2   TEXT,
  city            TEXT,
  zip             TEXT,
  country         TEXT NOT NULL DEFAULT 'DK',
  payment_terms   INT NOT NULL DEFAULT 30,
  plan            TEXT NOT NULL DEFAULT 'standard',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- USERS & ROLES
-- ============================================================
CREATE TABLE organisation_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN (
                    'employee','customer_admin',
                    'key_account_manager','warehouse','admin')),
  department_id   UUID,
  employee_number TEXT,
  full_name       TEXT,
  measurements    JSONB,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organisation_id, user_id)
);

-- ============================================================
-- DEPARTMENTS
-- ============================================================
CREATE TABLE departments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  budget_dkk      NUMERIC(12,2),
  budget_period   TEXT DEFAULT 'annual',   -- 'annual' | 'monthly'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE organisation_members
  ADD CONSTRAINT fk_department
  FOREIGN KEY (department_id) REFERENCES departments(id);

-- ============================================================
-- PRODUCT CATALOGUE
-- ============================================================
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id     TEXT NOT NULL,
  supplier_sku    TEXT NOT NULL,
  brand           TEXT NOT NULL,
  name            TEXT NOT NULL,
  name_en         TEXT,
  category        TEXT NOT NULL,
  subcategory     TEXT,
  gender          TEXT,
  material        TEXT,
  co2_kg          NUMERIC(6,3),
  co2_available   BOOLEAN NOT NULL DEFAULT false,
  primary_image   TEXT,         -- mirrored CDN URL
  is_active       BOOLEAN NOT NULL DEFAULT true,
  raw_data        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(supplier_id, supplier_sku)
);

CREATE TABLE product_variants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ean              TEXT UNIQUE,
  colour_name      TEXT,
  colour_hex       TEXT,
  size             TEXT,
  fit              TEXT,
  list_price_dkk   NUMERIC(10,2) NOT NULL,
  net_price_dkk    NUMERIC(10,2),
  stock_qty        INT NOT NULL DEFAULT 0,
  stock_incoming   JSONB,    -- {"4w": 200, "8w": 400, ...}
  stock_updated_at TIMESTAMPTZ,
  image_urls       TEXT[],
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-org scoped assortment
CREATE TABLE org_assortment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  is_enabled      BOOLEAN NOT NULL DEFAULT true,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organisation_id, product_id)
);

-- Per-org custom pricing
CREATE TABLE org_pricing (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id    UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  price_dkk          NUMERIC(10,2) NOT NULL,
  margin_pct         NUMERIC(6,3),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organisation_id, product_variant_id)
);

-- ============================================================
-- EMPLOYEE QUOTAS
-- ============================================================
CREATE TABLE employee_quotas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  member_id       UUID NOT NULL REFERENCES organisation_members(id) ON DELETE CASCADE,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  allowance_dkk   NUMERIC(10,2) NOT NULL DEFAULT 0,
  used_dkk        NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, period_start)
);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id     UUID NOT NULL REFERENCES organisations(id),
  member_id           UUID REFERENCES organisation_members(id),
  order_number        TEXT UNIQUE NOT NULL,   -- PDT-2026-00042
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                        'draft','pending_approval','approved','in_production',
                        'packing','shipped','delivered','cancelled','refunded')),
  payment_method      TEXT NOT NULL CHECK (payment_method IN (
                        'account','points','mobilepay','split')),
  account_amount_dkk  NUMERIC(10,2) NOT NULL DEFAULT 0,
  personal_amount_dkk NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_dkk           NUMERIC(10,2) NOT NULL,
  shipping_address    JSONB,
  gls_parcel_number   TEXT,
  gls_track_url       TEXT,
  economic_invoice_id TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_lines (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id               UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_variant_id     UUID NOT NULL REFERENCES product_variants(id),
  quantity               INT NOT NULL CHECK (quantity > 0),
  unit_price_dkk         NUMERIC(10,2) NOT NULL,
  logo_placement         TEXT,
  logo_method            TEXT,   -- 'embroidery' | 'print' | 'transfer'
  embellishment_cost_dkk NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_total_dkk         NUMERIC(10,2) NOT NULL
);

-- ============================================================
-- APPROVAL WORKFLOWS
-- ============================================================
CREATE TABLE approval_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  order_id        UUID NOT NULL REFERENCES orders(id),
  requested_by    UUID NOT NULL REFERENCES organisation_members(id),
  approver_id     UUID REFERENCES organisation_members(id),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected')),
  notes           TEXT,
  decided_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- BRAND ASSETS & DESIGN MANUAL
-- ============================================================
CREATE TABLE brand_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  file_url        TEXT NOT NULL,    -- Supabase Storage URL
  file_type       TEXT NOT NULL,    -- 'svg' | 'eps' | 'png'
  resolution_dpi  INT,
  is_approved     BOOLEAN NOT NULL DEFAULT false,
  uploaded_by     UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE design_manual_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id),
  brand_asset_id  UUID NOT NULL REFERENCES brand_assets(id),
  placement       TEXT NOT NULL,   -- 'chest_left' | 'back_top' | 'sleeve_left' | ...
  method          TEXT NOT NULL,   -- 'embroidery' | 'print' | 'transfer'
  width_mm        NUMERIC(6,1),
  height_mm       NUMERIC(6,1),
  pantone_codes   TEXT[],
  cmyk_values     JSONB,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AI GENERATION LOG (billing source — never delete)
-- ============================================================
CREATE TABLE ai_generation_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  product_sku     TEXT NOT NULL,
  logo_asset_id   UUID REFERENCES brand_assets(id),
  placement       TEXT NOT NULL,
  method          TEXT NOT NULL,
  provider        TEXT NOT NULL,   -- 'higgsfield' | 'wavespeed'
  cost_dkk        NUMERIC(8,4),
  cache_hit       BOOLEAN NOT NULL DEFAULT false,
  cache_key       TEXT,
  result_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PRODUCTION & WAREHOUSE
-- ============================================================
CREATE TABLE production_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  order_id        UUID NOT NULL REFERENCES orders(id),
  order_line_id   UUID NOT NULL REFERENCES order_lines(id),
  stage           TEXT NOT NULL DEFAULT 'queued' CHECK (stage IN (
                    'queued','printing','embroidering','packing','ready','shipped')),
  assigned_to     UUID REFERENCES auth.users(id),
  proof_approved  BOOLEAN,
  proof_url       TEXT,
  barcode         TEXT UNIQUE,
  notes           TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CRM & KAM
-- ============================================================
CREATE TABLE crm_contacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  full_name       TEXT NOT NULL,
  title           TEXT,
  email           TEXT,
  phone           TEXT,
  is_primary      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE kam_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  kam_user_id     UUID NOT NULL REFERENCES auth.users(id),
  activity_type   TEXT NOT NULL CHECK (activity_type IN (
                    'visit','call','email','gift','meeting')),
  notes           TEXT,
  next_action     TEXT,
  scheduled_at    TIMESTAMPTZ,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sales_pipeline (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID NOT NULL REFERENCES organisations(id),
  stage            TEXT NOT NULL DEFAULT 'prospect' CHECK (stage IN (
                     'prospect','proposal','negotiation','won','lost')),
  expected_arr_dkk NUMERIC(12,2),
  probability_pct  INT CHECK (probability_pct BETWEEN 0 AND 100),
  kam_user_id      UUID REFERENCES auth.users(id),
  close_date       DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SUPPLIER FEED TRACKING
-- ============================================================
CREATE TABLE supplier_feed_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id       TEXT NOT NULL,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'running'
                      CHECK (status IN ('running','completed','failed')),
  products_upserted INT DEFAULT 0,
  variants_upserted INT DEFAULT 0,
  error_message     TEXT
);

CREATE TABLE catalog_diffs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id  TEXT NOT NULL,
  feed_run_id  UUID REFERENCES supplier_feed_runs(id),
  diff_type    TEXT NOT NULL CHECK (diff_type IN (
                 'new_product','discontinued','price_change','stock_change')),
  product_id   UUID REFERENCES products(id),
  old_value    JSONB,
  new_value    JSONB,
  approved_by  UUID REFERENCES auth.users(id),
  approved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 3. Row-Level Security (RLS) Policies

**Every table gets RLS. No exceptions. Enable immediately after `CREATE TABLE`.**

```sql
-- Helper functions — call once
CREATE OR REPLACE FUNCTION auth.org_id() RETURNS UUID AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'organisation_id')::UUID;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.user_role() RETURNS TEXT AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role';
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- organisations
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_see_own" ON organisations
  FOR SELECT USING (id = auth.org_id());
CREATE POLICY "admin_all_orgs" ON organisations
  FOR ALL USING (auth.user_role() = 'admin');

-- organisation_members
ALTER TABLE organisation_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_see_own_org" ON organisation_members
  FOR SELECT USING (organisation_id = auth.org_id());
CREATE POLICY "cadmin_manage_members" ON organisation_members
  FOR ALL USING (
    organisation_id = auth.org_id()
    AND auth.user_role() IN ('customer_admin', 'admin')
  );

-- orders (employee sees own; elevated roles see all in org)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_read" ON orders FOR SELECT USING (
  organisation_id = auth.org_id() AND (
    auth.user_role() IN ('customer_admin','admin','warehouse','key_account_manager')
    OR member_id = (
      SELECT id FROM organisation_members
      WHERE user_id = auth.uid() AND organisation_id = auth.org_id()
    )
  )
);
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (
  organisation_id = auth.org_id()
  AND member_id = (
    SELECT id FROM organisation_members
    WHERE user_id = auth.uid() AND organisation_id = auth.org_id()
  )
);

-- brand_assets
ALTER TABLE brand_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brand_assets_own_org" ON brand_assets
  FOR ALL USING (organisation_id = auth.org_id());

-- ai_generation_log (insert only per user; admin reads all; no delete ever)
ALTER TABLE ai_generation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_log_insert" ON ai_generation_log
  FOR INSERT WITH CHECK (
    organisation_id = auth.org_id() AND user_id = auth.uid()
  );
CREATE POLICY "ai_log_admin_read" ON ai_generation_log
  FOR SELECT USING (auth.user_role() = 'admin');
```

> Apply the same `organisation_id = auth.org_id()` pattern to every remaining table. Run the `scripts/check-rls.js` CI gate on every migration.

---

## 4. Authentication & Role System

### 4.1 Role Definitions

```typescript
// lib/auth/roles.ts
export const ROLES = {
  EMPLOYEE:            'employee',
  CUSTOMER_ADMIN:      'customer_admin',
  KEY_ACCOUNT_MANAGER: 'key_account_manager',
  WAREHOUSE:           'warehouse',
  ADMIN:               'admin',
} as const;
export type Role = typeof ROLES[keyof typeof ROLES];

export interface UserAppMetadata {
  role: Role;
  organisation_id: string;
}
```

### 4.2 Next.js Middleware (Server-Side Route Guards)

```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ROUTE_ROLES: Record<string, string[]> = {
  '/dashboard/admin':     ['admin'],
  '/dashboard/warehouse': ['warehouse', 'admin'],
  '/dashboard/kam':       ['key_account_manager', 'admin'],
  '/dashboard/customer':  ['customer_admin', 'admin'],
  '/shop':                ['employee', 'customer_admin', 'admin'],
};

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.redirect(new URL('/login', req.url));
  const role = session.user.app_metadata?.role as string;
  const allowed = ROUTE_ROLES[req.nextUrl.pathname];
  if (allowed && !allowed.includes(role))
    return NextResponse.redirect(new URL('/403', req.url));
  return res;
}
```

### 4.3 Employee Invitation Flow

1. `customer_admin` enters email + role package + department.
2. Server calls `supabase.auth.admin.inviteUserByEmail(email, { data: { role: 'employee', organisation_id } })`.
3. Employee sets password via invite link → placed in org with correct RLS.

---

## 5. Phase 1 — Webshop & Order Flow

> **Scope boundary:** No AI fitting room. No e-conomic. No warehouse. No CRM.
> **Target:** ~October 2026.

### 5.1 Route Map

```
/                               org slug detection → /shop or /login
/login                          Supabase Auth
/shop                           Product grid
/shop/[productSlug]             Product detail + variant selector
/cart                           Cart
/checkout                       Split checkout (account + MobilePay)
/orders                         Order history (employee)
/orders/[orderNumber]           Order detail + status tracker
/dashboard/customer/            Customer Admin home
/dashboard/customer/employees
/dashboard/customer/departments
/dashboard/customer/budgets
/dashboard/customer/approvals
/dashboard/customer/orders
/dashboard/kam/                 KAM overview
/dashboard/kam/pipeline
/dashboard/kam/onboarding       3-step wizard
/dashboard/admin/               Platform admin
/dashboard/admin/orgs
/dashboard/admin/catalogs
/dashboard/admin/pricing
/dashboard/admin/roles
```

### 5.2 Product Catalog Requirements

- Category filter bar from `products.category` values scoped to org assortment.
- Colour swatches + size selector from `product_variants`.
- Stock status: `in_stock` / `low_stock` (< 10) / `out_of_stock` / `incoming_4w`.
- CO₂ badge when `co2_available = true`.
- Image from mirrored CDN — fallback to `public/placeholder-garment.svg`.
- Products outside org assortment: hidden (not 404).

### 5.3 Split Payment Logic

```
if (quota.used_dkk + cart_total <= quota.allowance_dkk)
  → pay on account
else
  → split: quota.remaining on account + overage via MobilePay
```

MobilePay webhook: **idempotent** via `payment_intent_id`. Log every webhook event to `payment_events` table before processing.

### 5.4 Order Status Tracker

```
Received → In Production → Packing → Shipped → Delivered
```

Driven by `orders.status`. Phase 1: admin updates manually. Phase 3: warehouse kanban auto-updates.

### 5.5 Customer Admin Capabilities

- Invite employees via Supabase Auth invite flow.
- Assign department + clothing allowance period (`employee_quotas`).
- Real-time quota usage view.
- Approval queue for over-budget orders.

### 5.6 KAM — 3-Step Onboarding Wizard

1. **Stamdata:** CVR auto-lookup (`https://cvrapi.dk/api`), EAN, address, payment terms, employee estimate.
2. **Assortment:** Toggle products into `org_assortment`.
3. **Activate:** Create org in DB, invite `customer_admin`. Check margin vs `minimum_dg_pct`; block if below threshold (admin override required).

### 5.7 Phase 1 Checklist

- [ ] Repo initialized under `Rasmuscort/` with branch protection
- [ ] Supabase project created, `.env.local` gitignored
- [ ] All Phase 1 tables migrated with RLS enabled
- [ ] `auth.org_id()` and `auth.user_role()` functions deployed
- [ ] Next.js middleware role guards tested across all 5 roles
- [ ] Product catalog: grid, filters, variants, stock status, CO₂ badge
- [ ] Cart + split-payment checkout
- [ ] MobilePay webhook (idempotent)
- [ ] Order status tracker
- [ ] Customer Admin: invite, quota management, approval queue
- [ ] KAM: 3-step onboarding with DG guardrail
- [ ] Mobile-optimised (375px+), tested on iOS Safari
- [ ] Vercel deployment, custom domain, env vars set
- [ ] **Rasmus review gate before Phase 2**

---

## 6. Phase 2 — AI Fitting Room, Pricing & Brand Library

> **Target:** ~November 2026. Phase 1 must be deployed and signed off first.

### 6.1 AI Fitting Room Architecture

**Provider:** Evaluate Higgsfield vs. Wavespeed on cost-per-acceptable-result. Target ≤ 0.50 DKK.

**Embroidery note:** Show clear placement and character scale. Do NOT attempt photorealistic thread texture — a clean composited placement is acceptable and far more reliable to generate at target cost.

**Generation pipeline:**

```
1. User picks product variant + logo from brand library + placement + method
2. Build cache key: SHA256(product_variant_id + logo_asset_id + placement + method)
3. Check Supabase Storage for cached result
   HIT  → return URL, log cache_hit=true, skip API call
   MISS → check rate limit (10/hr per user, count cache_hit=false rows)
           LIMIT HIT → HTTP 429, Retry-After header
           OK        → call AI provider, store in Storage, log to ai_generation_log
4. Return image URL to client
```

### 6.2 Logo Upload & Brand Library

- Accepted formats: SVG, EPS, high-res PNG.
- Server-side DPI check via Sharp — warn if below 300 DPI.
- Background removal: `@imgly/background-removal` (client-side) or AI endpoint.
- Storage path: `brand-assets/{org_id}/{asset_id}/original.{ext}`
- Only `customer_admin` and `admin` can upload and approve. Employees select from approved library only.

### 6.3 Price Calculator

- Base price from `org_pricing` → fallback to `product_variants.list_price_dkk`.
- Embellishment: setup cost + per-unit cost by method + placement.
- Volume discount tiers (configurable per org in admin).
- Quote PDF via `@react-pdf/renderer`: line items, placements, totals, logo spec.

### 6.4 Size Guide

- Size charts per brand sourced from supplier feed data.
- "Find my size" calculator: measurements → suggested size.
- Store per-employee measurements in `organisation_members.measurements JSONB`.

### 6.5 Phase 2 Checklist

- [ ] AI provider selected and cost-tested
- [ ] Cache layer: identical input → zero additional API calls
- [ ] Rate limiter: 429 + Retry-After after 10 uncached generations/hr/user
- [ ] `ai_generation_log` populated on every call (cached and uncached)
- [ ] Logo upload: DPI check, background removal, Storage path
- [ ] Brand library per org (approved logos only for employees)
- [ ] Fitting room UI: product + logo + placement + method
- [ ] Embroidery: clear placement mockup (no thread texture required)
- [ ] Embellishment price calculator + volume tiers
- [ ] Quote PDF generator
- [ ] Size guide + per-employee measurements

---

## 7. Phase 3 — Proofing, Production & Warehouse

> **Target:** ~December 2026.

### 7.1 Visual Proofing Flow

```
Order with logo → proof created (auto or manual upload) → customer email
→ Customer opens signed URL → Approves / Requests changes
→ APPROVED: production_job.stage = 'printing' | 'embroidering'
→ CHANGES:  new proof loop
```

Proof approval is **mandatory** before any production starts. No bypass.

### 7.2 Production Kanban

Stages: `Queued → Printing/Embroidering → Packing → Ready → Shipped`

- Drag-and-drop for warehouse staff.
- Card move auto-updates `orders.status` + `production_jobs.stage`.
- Filter by date, priority, customer.
- Print production sheet per order: garments, sizes, colours, placement, method, dimensions (mm).

### 7.3 Pack & Ship — GLS Integration

```typescript
// lib/integrations/shipping/gls/index.ts
export async function createGlsLabel(order: Order): Promise<GlsLabelResult>
// POST to GLS API → returns parcel_number, label_pdf_url, track_url
// Writes: orders.gls_parcel_number, orders.gls_track_url, orders.status = 'shipped'
```

- Barcode scanner: physical scanner → HTML input field → `keyup Enter` handler triggers label creation.
- Label PDF displayed inline for printing.

### 7.4 Stock Management

- Per-variant stock view with incoming windows (4/8/12/16 weeks from supplier feeds).
- Manual stock adjustment with audit trail entry.
- Back-order queue for out-of-stock variants.

### 7.5 Phase 3 Checklist

- [ ] Proof upload + customer email (signed URL, no login required)
- [ ] Customer proof approval portal
- [ ] Production Kanban with drag-and-drop
- [ ] Kanban → `orders.status` sync
- [ ] Production sheet print export
- [ ] Barcode generation per `production_job`
- [ ] Barcode scanner input handler
- [ ] GLS label generation + PDF display
- [ ] Stock view with incoming windows
- [ ] Back-order queue
- [ ] Returns: customer request + prepaid GLS label

---

## 8. Phase 4 — Integrations, Economy, CRM & Analytics

> **Target:** ~January 2027. Lowest budget of the four phases. No scope expansion without Rasmus sign-off.

### 8.1 e-conomic Integration

```typescript
// lib/integrations/economic/index.ts
export class EconomicClient {
  createDebtor(org: Organisation): Promise<string>        // → debtor number
  createInvoice(order: Order): Promise<string>            // → invoice number
  createBatchInvoice(orders: Order[]): Promise<string>    // → consolidated invoice
  syncPaymentStatus(): Promise<void>                      // reconcile paid / overdue
}
```

- `orders.status = 'delivered'` → auto-trigger `createInvoice()`.
- Daily cron `POST /api/cron/batch-invoice` → batch consolidation for `payment_method = 'account'` orders.
- Nightly cron `POST /api/cron/reconcile` → pull e-conomic payment status, update `orders.economic_invoice_id`.
- **e-conomic is the finance master. The platform is the order master.**

### 8.2 Supplier Feed Automation Priority

| Priority | Supplier | Transport | Status |
|---|---|---|---|
| 1 | F&H / You | HTTPS CSV | Live — `You_katalog_fuld.json` already imported |
| 2 | TEE JAYS | SFTP `sftp.teejays.com:22` | Access active |
| 3 | Fristads / Kansas | FTP `ftp.fristads.com` | Feed access received |
| 4 | Mascot / Engel | FTP nightly + EDIFACT | Info received |
| 5 | NWG / New Wave | GraphQL API | Docs received — needs token + assortmentId |
| 6 | ID Identity / Nimbus / PF Concept | Various | Pending access |
| 7 | Snickers / Hultafors | PartnerPortal + EDI | Semi-manual until API offered |

All feeds write to `supplier_feed_runs` → `catalog_diffs` → admin reviews diff in UI → approves → products/variants updated.

> **Secrets rule:** Every FTP/SFTP credential, API token, and EDI cert lives in Vercel Environment Variables or Doppler. Never in code, never in Notion, never in the prototype.

### 8.3 CRM & KAM

- Customer card: spend, open orders, invoices, track & trace, annual CO₂.
- KAM activity log: visits, calls, gifts, meetings.
- 90-day no-visit alert: weekly cron checks `MAX(occurred_at)` per org in `kam_activities`.
- Sales pipeline kanban: prospect → proposal → negotiation → won/lost.
- DG per order/customer/product with guardrail warning when below minimum.

### 8.4 Analytics — Fixed 6 Charts, Nothing More

| Chart | Data source |
|---|---|
| Revenue — monthly, YTD vs. last year | `orders` |
| Orders by status | `orders` |
| Top 10 products by revenue | `order_lines` |
| Top 10 customers by spend | `orders` |
| Average DG % (with guardrail indicator) | `org_pricing` + `order_lines` |
| AI generations per month (total + cost, per org) | `ai_generation_log` |

No configurable dashboard. Ship exactly these six.

### 8.5 Phase 4 Checklist

- [ ] e-conomic: debtor creation on onboarding
- [ ] e-conomic: invoice on delivery (auto-triggered)
- [ ] Batch invoice cron (daily)
- [ ] Payment reconciliation cron (nightly)
- [ ] F&H/You feed cron (daily)
- [ ] TEE JAYS SFTP pull (daily)
- [ ] Fristads/Kansas FTP pull (daily)
- [ ] NWG GraphQL adapter (pending token)
- [ ] Catalog diff review UI for admin
- [ ] KAM CRM: customer card, activity log, pipeline
- [ ] 90-day inactivity cron
- [ ] DG guardrail warning per order
- [ ] Fixed analytics dashboard (6 charts)
- [ ] Load testing, OWASP security review, GDPR compliance check
- [ ] Handover documentation + runbook

---

## 9. Supplier Integration Layer

### 9.1 Adapter Interface Contract

Every supplier adapter implements this interface:

```typescript
// lib/integrations/suppliers/types.ts
export interface SupplierAdapter {
  readonly supplierId: string;
  fetchProducts(): Promise<NormalizedProduct[]>;
  fetchStock(): Promise<StockUpdate[]>;
  placeOrder?(order: Order): Promise<SupplierOrderResult>;
}

export interface NormalizedProduct {
  supplierSku:  string;
  brand:        string;
  nameDa:       string;       // Danish — normalise on import
  category:     string;
  variants:     NormalizedVariant[];
  primaryImage: string;       // mirrored CDN URL
  co2Kg?:       number | null;
  rawData:      unknown;
}

export interface NormalizedVariant {
  ean:            string;
  colourName:     string;
  colourHex?:     string;
  size:           string;
  fit?:           string;
  listPriceDkk:   number;
  netPriceDkk?:   number;
  stockQty:       number;
  stockIncoming?: Record<string, number>;  // "4w", "8w", "12w", "16w"
  imageUrls:      string[];
}
```

### 9.2 Image Mirroring

1. On feed import, `GET` each image URL → upload to Supabase Storage: `product-images/{supplier_id}/{sku}/{sha256}.jpg`.
2. Store mirrored URL in `products.primary_image` and `product_variants.image_urls[]`.
3. If supplier CDN returns 404: mirrored copy serves.
4. Final fallback: `public/placeholder-garment.svg` (inline SVG, always available).
5. Normalise all category names to Danish on import (`Gensere` → `Sweatshirts`, etc.).

### 9.3 Vercel Cron Schedule

```json
{
  "crons": [
    { "path": "/api/cron/feed/fh-you",    "schedule": "0 2 * * *"    },
    { "path": "/api/cron/feed/teejays",   "schedule": "0 3 * * *"    },
    { "path": "/api/cron/feed/fristads",  "schedule": "0 4 * * *"    },
    { "path": "/api/cron/feed/mascot",    "schedule": "0 5 * * *"    },
    { "path": "/api/cron/feed/engel",     "schedule": "0 5 * * *"    },
    { "path": "/api/cron/batch-invoice",  "schedule": "0 22 * * *"   },
    { "path": "/api/cron/reconcile",      "schedule": "0 23 * * *"   },
    { "path": "/api/cron/kam-reminders",  "schedule": "0 8 * * MON"  }
  ]
}
```

---

## 10. CI/CD & Repository Conventions

### 10.1 Branch Strategy

```
main       ← production (Vercel prod)
staging    ← pre-production review (Vercel preview)
feature/*  ← short-lived feature branches
hotfix/*   ← emergency patches straight to main
```

### 10.2 GitHub Actions Gates (all must pass before merge to main)

```yaml
# .github/workflows/ci.yml
on: [push, pull_request]
jobs:
  lint:       { run: npm ci && npm run lint }
  typecheck:  { run: npm ci && npm run typecheck }
  test:       { run: npm ci && npm test }
  rls-check:  { run: node scripts/check-rls.js }
  secrets-scan: # detect any hardcoded credential in diff
  claude-review:
    uses: Rasmuscort/.github/workflows/claude-review.yml@main
```

### 10.3 `scripts/check-rls.js`

Scans `supabase/migrations/*.sql` for any `CREATE TABLE` not followed by `ENABLE ROW LEVEL SECURITY`. Fails the CI gate if found.

### 10.4 Environment Variables Template

```bash
# .env.local — gitignored, never committed
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only
ECONOMIC_APP_SECRET_TOKEN=
MOBILEPAY_API_KEY=
MOBILEPAY_WEBHOOK_SECRET=
GLS_API_KEY=
HIGGSFIELD_API_KEY=
WAVESPEED_API_KEY=
TEEJAYS_SFTP_HOST=sftp.teejays.com
TEEJAYS_SFTP_USER=
TEEJAYS_SFTP_PASS=
FRISTADS_FTP_HOST=ftp.fristads.com
FRISTADS_FTP_USER=
FRISTADS_FTP_PASS=
NWG_GRAPHQL_TOKEN=
NWG_ASSORTMENT_ID=
CVR_API_BASE=https://cvrapi.dk/api
```

---

## 11. Open Questions (Kickoff)

> Flag to Rasmus. Do not assume answers. On fixed price, every wrong assumption is unbilled work.

| # | Question | Why it matters |
|---|---|---|
| **Q1** | Which ERP/order system does PDT run today? | Determines catalogue and stock sync. Handover notes say Rackbeat is being retired — confirm. |
| **Q2** | Does that system already push to e-conomic? | Could simplify Phase 4 or move our integration point. |
| **Q3** | Exact access status for each supplier feed? | TEE JAYS is active. NWG needs token + assortmentId. Others: who gets credentials into secrets manager, and by when? |
| **Q4** | What is the minimum-DG threshold for the KAM guardrail? | Needs a default value in Phase 1. Should be configurable, but must exist from day one. |
| **Q5** | MobilePay for personal payments only, or also some B2B accounts? | Affects checkout split logic and payment provider scope. |
| **Q6** | Subdomain routing (`{org}.profildesigntrading.dk`) or path routing (`/shop/{org}`)? | Affects Next.js routing, Vercel domain config, Supabase Auth redirect URLs. Decide before Phase 1 routes are built. |
| **Q7** | Who runs the Higgsfield vs. Wavespeed cost evaluation, and by when? | Phase 2 cannot start without provider selection. |
| **Q8** | Does PDT have an existing e-conomic account and API token? | Phase 4 is blocked without it. Get credentials before Phase 3 ends. |

---

*Read the prototype before coding any screen. Read this document before writing any code. Raise scope questions with Rasmus — not into assumptions.*
