import {
  check,
  index,
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
import { organisationMembers, organisations } from "./organisations";
import { productVariants } from "./catalogue";
import {
  approvalStatus,
  embellishmentMethod,
  orderStatus,
  paymentMethod,
} from "./enums";

/* Authorisation lives in lib/db/sql/10-rls-policies.sql — see organisations.ts. */

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id),
    memberId: uuid("member_id").references(() => organisationMembers.id),
    /** Human-facing reference, e.g. PDT-2026-00042. */
    orderNumber: text("order_number").notNull(),
    status: orderStatus("status").notNull().default("draft"),
    paymentMethod: paymentMethod("payment_method").notNull(),
    /** Split checkout: allowance portion billed to the company account… */
    accountAmountDkk: numeric("account_amount_dkk", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    /** …and the overage the employee pays personally via MobilePay. */
    personalAmountDkk: numeric("personal_amount_dkk", {
      precision: 10,
      scale: 2,
    })
      .notNull()
      .default("0"),
    totalDkk: numeric("total_dkk", { precision: 10, scale: 2 }).notNull(),
    shippingAddress: jsonb("shipping_address"),
    glsParcelNumber: text("gls_parcel_number"),
    glsTrackUrl: text("gls_track_url"),
    economicInvoiceId: text("economic_invoice_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_order_number_key").on(t.orderNumber),
    index("orders_org_status_idx").on(t.organisationId, t.status),
    // The split must always reconcile to the total, enforced by the database
    // rather than trusted from whatever the checkout posted.
    check(
      "orders_amounts_sum_to_total",
      sql`${t.accountAmountDkk} + ${t.personalAmountDkk} = ${t.totalDkk}`,
    ),
  ],
).enableRLS();

export const orderLines = pgTable(
  "order_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** Denormalised from the parent order so RLS does not need a join per row. */
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id),
    productVariantId: uuid("product_variant_id")
      .notNull()
      .references(() => productVariants.id),
    quantity: integer("quantity").notNull(),
    unitPriceDkk: numeric("unit_price_dkk", { precision: 10, scale: 2 }).notNull(),
    logoPlacement: text("logo_placement"),
    logoMethod: embellishmentMethod("logo_method"),
    embellishmentCostDkk: numeric("embellishment_cost_dkk", {
      precision: 10,
      scale: 2,
    })
      .notNull()
      .default("0"),
    lineTotalDkk: numeric("line_total_dkk", { precision: 10, scale: 2 }).notNull(),
  },
  (t) => [
    index("order_lines_order_idx").on(t.orderId),
    check("order_lines_quantity_positive", sql`${t.quantity} > 0`),
  ],
).enableRLS();

export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => organisationMembers.id),
    approverId: uuid("approver_id").references(() => organisationMembers.id),
    status: approvalStatus("status").notNull().default("pending"),
    notes: text("notes"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("approval_requests_org_status_idx").on(t.organisationId, t.status),
  ],
).enableRLS();
