import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organisationMembers, organisations } from "./organisations";
import { productVariants, products } from "./catalogue";

/* Authorisation lives in lib/db/sql/10-rls-policies.sql — see organisations.ts. */

/** Which products an organisation is allowed to see and order. */
export const orgAssortment = pgTable(
  "org_assortment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    isEnabled: boolean("is_enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("org_assortment_org_product_key").on(
      t.organisationId,
      t.productId,
    ),
  ],
).enableRLS();

/**
 * Per-organisation price for a variant. The same garment legitimately costs
 * different amounts for different customers, which is why price lives here and
 * not on the shared variant.
 *
 * Prices are never trusted from the client at checkout — the server re-reads
 * this table.
 */
export const orgPricing = pgTable(
  "org_pricing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    productVariantId: uuid("product_variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    priceDkk: numeric("price_dkk", { precision: 10, scale: 2 }).notNull(),
    marginPct: numeric("margin_pct", { precision: 6, scale: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("org_pricing_org_variant_key").on(
      t.organisationId,
      t.productVariantId,
    ),
  ],
).enableRLS();

/** Clothing allowance per employee per period. */
export const employeeQuotas = pgTable(
  "employee_quotas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => organisationMembers.id, { onDelete: "cascade" }),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    allowanceDkk: numeric("allowance_dkk", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    usedDkk: numeric("used_dkk", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("employee_quotas_member_period_key").on(
      t.memberId,
      t.periodStart,
    ),
  ],
).enableRLS();
