import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authUsers } from "drizzle-orm/supabase";
import { supplierChannel, supplierOrderStatus } from "./enums";
import { orderLines } from "./orders";
import { productVariants } from "./catalogue";

/*
 * AUTHORISATION IS NOT DEFINED IN THIS FILE — see organisations.ts.
 *
 * These three tables are PDT's OWN purchasing, not a customer's. They carry no
 * organisation_id and are never tenant-scoped: a customer must not learn what
 * PDT pays a supplier, nor that their order is being pooled with someone
 * else's. The policies in lib/db/sql/10-rls-policies.sql restrict them to
 * platform staff.
 */

/**
 * A supplier PDT buys from.
 *
 * `code` matches `products.supplier_id`, which the catalogue import already
 * writes, so the two link up without a migration of the product rows.
 *
 * Ordering and data collection are separate channels on purpose: Mascot takes
 * orders over EDI but ships product data as a nightly FTP file, and F&H has no
 * order API at all — CSV upload into their B2B shop. Modelling one "integration
 * type" would force a lie for most of the list.
 */
export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Matches products.supplier_id, e.g. "YOU", "MASCOT". */
    code: text("code").notNull(),
    name: text("name").notNull(),
    productGroup: text("product_group"),
    /** How ORDERS reach them. */
    orderChannel: supplierChannel("order_channel").notNull().default("email"),
    /** How product and stock data reaches us — prose, because it varies wildly. */
    dataChannel: text("data_channel"),
    /**
     * Minimum units per delivery. Orders below it are pooled across customers
     * until the minimum is met — the accumulator on Ordre & leverandør.
     */
    minimumOrderQty: integer("minimum_order_qty").notNull().default(0),
    minimumOrderValueDkk: numeric("minimum_order_value_dkk", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    leadTimeDays: integer("lead_time_days").notNull().default(5),
    contactEmail: text("contact_email"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("suppliers_code_key").on(t.code)],
).enableRLS();

/**
 * A purchase order towards one supplier.
 *
 * At most ONE `accumulating` order per supplier at a time — that is the basket
 * new demand drops into. The partial unique index below enforces it in the
 * database rather than trusting every call site to check first.
 */
export const supplierOrders = pgTable(
  "supplier_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    status: supplierOrderStatus("status").notNull().default("accumulating"),
    /** The supplier's own reference, once they confirm. */
    reference: text("reference"),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releasedBy: uuid("released_by").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("supplier_orders_supplier_status_idx").on(t.supplierId, t.status),
    // One open basket per supplier. Postgres treats every row in a partial
    // index as distinct only where the predicate holds, so released and
    // received orders are unconstrained.
    uniqueIndex("supplier_orders_one_open_per_supplier")
      .on(t.supplierId)
      .where(sql`status = 'accumulating'`),
  ],
).enableRLS();

/**
 * What is on that purchase order.
 *
 * `orderLineId` records WHICH customer line the units are for, so a released
 * purchase order can be traced back to the people waiting on it. It is nullable
 * because PDT also buys to replenish its own shelf, with no customer attached.
 */
export const supplierOrderLines = pgTable(
  "supplier_order_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierOrderId: uuid("supplier_order_id")
      .notNull()
      .references(() => supplierOrders.id, { onDelete: "cascade" }),
    productVariantId: uuid("product_variant_id")
      .notNull()
      .references(() => productVariants.id),
    orderLineId: uuid("order_line_id").references(() => orderLines.id, {
      onDelete: "set null",
    }),
    quantity: integer("quantity").notNull(),
    unitCostDkk: numeric("unit_cost_dkk", { precision: 10, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("supplier_order_lines_order_idx").on(t.supplierOrderId),
    check("supplier_order_lines_quantity_positive", sql`${t.quantity} > 0`),
  ],
).enableRLS();
