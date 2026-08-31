import {
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { notificationStatus, paymentStatus } from "./enums";
import { orders } from "./orders";

/**
 * Payments, webhook idempotency and the notification outbox.
 *
 * These three tables are the seam between Next and the Supabase Edge Functions.
 * A function runs Deno and cannot import this file, Drizzle, or anything else in
 * lib/ — so the SHARED CONTRACT IS THE DATABASE, not TypeScript. Both runtimes
 * go through the `security definer` functions in
 * lib/db/sql/20-payment-functions.sql; neither writes these tables directly.
 *
 * That is why none of them carries a Drizzle relation to application logic: the
 * columns are the interface, and changing one means changing the SQL function
 * that guards it, in the same migration.
 */

/**
 * One row per payment attempt against an order.
 *
 * ONLY THE PERSONAL SHARE GOES THROUGH STRIPE. `orders.account_amount_dkk` is
 * billed to the company on its payment terms (D-5, invoice at dispatch) and
 * never touches a card. An order with no personal share has no payment row at
 * all — which is most orders.
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** "stripe" today. Kept so a second provider does not need a new table. */
    provider: text("provider").notNull().default("stripe"),
    /**
     * Stripe's PaymentIntent id. UNIQUE, and the reason a replayed webhook
     * cannot create a second payment row for the same charge.
     */
    providerRef: text("provider_ref").notNull(),
    status: paymentStatus("status").notNull().default("requires_payment"),
    amountDkk: numeric("amount_dkk", { precision: 10, scale: 2 }).notNull(),
    /** Minor units as Stripe counts them — øre. Stored to reconcile against. */
    amountMinor: numeric("amount_minor", { precision: 12, scale: 0 }).notNull(),
    currency: text("currency").notNull().default("dkk"),
    /** Card, MobilePay — whatever Stripe reports actually paid it. */
    methodDetail: text("method_detail"),
    failureReason: text("failure_reason"),
    /** When the money was actually captured, not when the intent was made. */
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("payments_provider_ref_key").on(t.provider, t.providerRef),
    index("payments_order_idx").on(t.orderId),
  ],
).enableRLS();

/**
 * Every Stripe event id we have already processed.
 *
 * Stripe retries a webhook until it gets a 2xx, and explicitly does not promise
 * to deliver only once. Without this table a retried `payment_intent.succeeded`
 * would be applied twice — which for a refund or a capture means money moving
 * twice. The insert is the lock: the primary key rejects the second delivery.
 */
export const stripeEvents = pgTable(
  "stripe_events",
  {
    /** Stripe's own event id, e.g. evt_3Q…. */
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    /**
     * The raw event, kept for reconciliation. Stripe's own dashboard is the
     * other copy; this one is the one available when a customer disputes what
     * we did with it.
     */
    payload: jsonb("payload"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("stripe_events_received_idx").on(t.receivedAt)],
).enableRLS();

/**
 * Things somebody should be told about.
 *
 * An OUTBOX, not a send-on-the-spot call. Enqueuing is part of the transaction
 * that caused it, so an order that commits always has its notification and an
 * order that rolls back never sends one. Delivery happens afterwards, in the
 * `notify` Edge Function — which means the mail provider being down delays
 * mail rather than failing checkout.
 */
export const notificationOutbox = pgTable(
  "notification_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** e.g. order_placed, approval_requested, application_received. */
    kind: text("kind").notNull(),
    recipient: text("recipient").notNull(),
    /** Locale to send in — this platform is bilingual and guessing is rude. */
    locale: text("locale").notNull().default("da"),
    subject: text("subject").notNull(),
    /** Everything the template needs. No PII beyond what the mail itself shows. */
    payload: jsonb("payload").notNull(),
    status: notificationStatus("status").notNull().default("pending"),
    attempts: numeric("attempts", { precision: 4, scale: 0 })
      .notNull()
      .default("0"),
    lastError: text("last_error"),
    /**
     * Set while a drain run holds the row, so two overlapping cron ticks cannot
     * send the same mail twice.
     */
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("notification_outbox_pending_idx").on(t.status, t.createdAt)],
).enableRLS();
