import { pgEnum } from "drizzle-orm/pg-core";

/** The five roles hardened in Phase 1. Mirrored in lib/auth/roles.ts. */
export const memberRole = pgEnum("member_role", [
  "employee",
  "customer_admin",
  "key_account_manager",
  "warehouse",
  "admin",
]);

export const budgetPeriod = pgEnum("budget_period", ["annual", "monthly"]);

/**
 * Whether employees see kroner or an abstract point balance.
 * The prototype's kunde-admin can flip this per customer.
 */
export const displayMode = pgEnum("display_mode", ["price", "points"]);

/**
 * Order state — decided, not inferred.
 *
 * D-3 fixes the customer-visible happy path at exactly four stages:
 * Booked → Arrived at warehouse → Sent to print/embroidery → Delivered.
 * Goods arriving from the supplier is a stage because PDT buys in per order.
 *
 * Q-C3 adds the states an order needs when it does not take the happy path:
 * `pending_approval` (D-2 makes a customer admin decide), `cancelled` and
 * `rejected` (D-5 refers to "cancellation/rejection before dispatch"). The
 * tracker renders those as an interruption, not as a step.
 *
 * There is NO dispatch state. Q-C2 (c): dispatch is an event — the parcel
 * number, the invoice and `orders.dispatched_at` are stamped without moving
 * the order — so "Leveret" keeps meaning the customer has it.
 *
 * `refunded` is kept from the previous enum rather than added: D-6 gives
 * returns an owner but the returns model is not built, and dropping the value
 * would discard any order already in it. Where a refund finally lives —
 * here or on a `returns` row — is still open.
 */
export const orderStatus = pgEnum("order_status", [
  "pending_approval",
  "booked",
  "arrived_at_warehouse",
  "sent_to_print",
  "delivered",
  "cancelled",
  "rejected",
  "refunded",
]);

export const paymentMethod = pgEnum("payment_method", [
  "account",
  "points",
  "mobilepay",
  "split",
]);

export const approvalStatus = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
]);

export const embellishmentMethod = pgEnum("embellishment_method", [
  "embroidery",
  "print",
  "transfer",
]);

/**
 * How ORDERS reach a supplier. Data collection is a separate concern — see
 * suppliers.data_channel — because most suppliers use different routes for the
 * two (Mascot: EDI for orders, nightly FTP for product data).
 */
export const supplierChannel = pgEnum("supplier_channel", [
  "api",
  "graphql",
  "edi",
  "ftp",
  "sftp",
  "portal",
  "csv",
  "email",
]);

/**
 * `accumulating` is the open basket demand drops into; `ready` means the
 * supplier's minimum is met and it can be sent. Everything after that is the
 * supplier's side of the conversation.
 */
export const supplierOrderStatus = pgEnum("supplier_order_status", [
  "accumulating",
  "ready",
  "released",
  "confirmed",
  "received",
  "cancelled",
]);
