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

export const orderStatus = pgEnum("order_status", [
  "draft",
  "pending_approval",
  "approved",
  "in_production",
  "packing",
  "shipped",
  "delivered",
  "cancelled",
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
