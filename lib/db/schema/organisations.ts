import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUsers } from "drizzle-orm/supabase";
import { budgetPeriod, displayMode, memberRole } from "./enums";

/*
 * AUTHORISATION IS NOT DEFINED IN THIS FILE.
 *
 * `.enableRLS()` turns Row-Level Security on; the policies themselves live in
 * lib/db/sql/10-rls-policies.sql and are applied by `npm run db:bootstrap`.
 *
 * They are not declared here because `drizzle-kit push` creates policy objects
 * without their USING / WITH CHECK expressions, and a predicate-less policy
 * permits every row — which silently removes tenant isolation. See the header of
 * that SQL file.
 */

/** Tenancy root. Every other tenant-scoped table hangs off this. */
export const organisations = pgTable(
  "organisations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    cvr: text("cvr"),
    ean: text("ean"),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    zip: text("zip"),
    country: text("country").notNull().default("DK"),
    paymentTerms: integer("payment_terms").notNull().default(30),
    /** Minimum contribution margin a KAM may not go below without an admin override. */
    minimumDgPct: numeric("minimum_dg_pct", { precision: 5, scale: 2 })
      .notNull()
      .default("35"),
    plan: text("plan").notNull().default("standard"),

    /* --- Customer-configurable settings (kunde-admin → Indstillinger) --- */

    /** Employees see kroner, or an abstract point balance. */
    displayMode: displayMode("display_mode").notNull().default("price"),
    /** Default annual clothing allowance applied to new employees. */
    defaultAllowanceDkk: numeric("default_allowance_dkk", {
      precision: 10,
      scale: 2,
    })
      .notNull()
      .default("1500"),
    /** Orders above this go through the approval chain. */
    orderApprovalLimitDkk: numeric("order_approval_limit_dkk", {
      precision: 10,
      scale: 2,
    })
      .notNull()
      .default("1000"),
    /** Whether employees may buy personal items alongside company wear. */
    allowPersonalPurchases: boolean("allow_personal_purchases")
      .notNull()
      .default(true),

    isActive: boolean("is_active").notNull().default(true),

    /**
     * PDT ITSELF, not a customer.
     *
     * docs/PLATFORM-ADMIN.md: *"Staff accounts belong to PDT, not to a customer
     * company."* Every other table hangs off `organisation_id`, and RLS reads it
     * from the token — so PDT's own people need an organisation to belong to,
     * or every policy needs a null special case. One flagged row is far cheaper
     * than a nullable tenancy key.
     *
     * Exactly one row may carry this flag; the partial unique index below is
     * what enforces it, rather than trusting every call site to check first.
     */
    isPlatform: boolean("is_platform").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("organisations_slug_key").on(t.slug),
    uniqueIndex("organisations_one_platform")
      .on(t.isPlatform)
      .where(sql`is_platform = true`),
  ],
).enableRLS();

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    budgetDkk: numeric("budget_dkk", { precision: 12, scale: 2 }),
    budgetPeriod: budgetPeriod("budget_period").notNull().default("annual"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
).enableRLS();

/**
 * Join between a Supabase auth user and an organisation, carrying the role.
 *
 * The role is ALSO written to the user's JWT app_metadata — that copy is what RLS
 * reads, because a policy cannot query this table to authorise access to this table
 * without recursing. Keep the two in step: see lib/auth/roles.ts.
 */
export const organisationMembers = pgTable(
  "organisation_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("employee"),
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    employeeNumber: text("employee_number"),
    fullName: text("full_name"),
    /** Chest/waist/height etc., used by the size adviser. */
    measurements: jsonb("measurements"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("organisation_members_org_user_key").on(
      t.organisationId,
      t.userId,
    ),
  ],
).enableRLS();
