"use server";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  approvalRequests,
  employeeQuotas,
  orderLines,
  orders,
  organisations,
} from "@/lib/db/schema";
import { AuthorizationError, requireUser } from "@/lib/auth/guards";
import { getMember, priceVariants } from "@/lib/db/queries/shop";
import { cartLineKey, type CartItem } from "@/lib/cart";
import {
  embellishmentCost,
  isLogoMethod,
  isLogoPlacement,
  placementColumn,
  primaryMethod,
  sortLogos,
  type CartLogo,
} from "@/lib/shop/logo";

export type PricedCartLine = {
  /** Identity of the line: variant plus logo choice. See lib/cart.ts. */
  lineKey: string;
  variantId: string;
  productName: string;
  slug: string;
  image: string | null;
  colourName: string | null;
  size: string | null;
  /** Garment price before decoration. */
  unitPrice: string;
  /** Decoration surcharge for one garment, 0 when undecorated. */
  embellishment: number;
  logos: CartLogo[];
  qty: number;
  lineTotal: number;
  stockQty: number;
  co2Kg: number | null;
};

export type CartSummary = {
  ok: true;
  lines: PricedCartLine[];
  /** Ids the client sent that are no longer purchasable and were dropped. */
  droppedVariantIds: string[];
  total: number;
  co2Total: number;
  co2Partial: boolean;
  allowance: number;
  used: number;
  remaining: number;
  hasQuota: boolean;
  onAccount: number;
  personal: number;
  approvalLimit: number;
  needsApproval: boolean;
  personalBlocked: boolean;
  /** Whether this customer shows kroner or points to its employees. */
  displayMode: "price" | "points";
};

export type CartResult = CartSummary | { ok: false; message: string };

/** Caps what a single request can ask us to price, and drops unknown logo ids. */
function sanitise(items: CartItem[]): CartItem[] {
  return items
    .filter((i) => typeof i?.variantId === "string" && Number.isFinite(i?.qty))
    .map((i) => ({
      variantId: i.variantId,
      qty: Math.max(1, Math.min(999, Math.trunc(i.qty))),
      logos: sanitiseLogos(i.logos),
    }))
    .slice(0, 100);
}

function sanitiseLogos(logos: unknown): CartLogo[] {
  if (!Array.isArray(logos)) return [];
  const seen = new Set<string>();
  const clean: CartLogo[] = [];
  for (const l of logos) {
    if (!l || !isLogoPlacement(l.placement) || !isLogoMethod(l.method)) continue;
    if (seen.has(l.placement)) continue;
    seen.add(l.placement);
    clean.push({ placement: l.placement, method: l.method });
  }
  return sortLogos(clean).slice(0, 4);
}

/**
 * Prices a cart.
 *
 * THE SERVER IS THE ONLY PRICE AUTHORITY. The browser sends variant ids and
 * quantities; every unit price, the order total and the account/personal split
 * are recomputed here from org_pricing and employee_quotas. Nothing the client
 * sends about money is read.
 *
 * Used by both the cart and the checkout page so the two can never disagree.
 */
export async function priceCart(items: CartItem[]): Promise<CartResult> {
  try {
    const user = await requireUser();
    if (!user.organisationId) {
      return { ok: false, message: "No organisation on this account" };
    }
    const organisationId = user.organisationId;

    const wanted = sanitise(items);
    if (wanted.length === 0) {
      return emptySummary(await orgSettings(organisationId));
    }

    const priced = await priceVariants(
      organisationId,
      wanted.map((i) => i.variantId),
    );
    const byId = new Map(priced.map((p) => [p.variantId, p]));

    const lines: PricedCartLine[] = [];
    const droppedVariantIds: string[] = [];

    for (const item of wanted) {
      const p = byId.get(item.variantId);
      // Not in the organisation's assortment any more, or deactivated. Dropping
      // it is the only safe move — pricing it from the client's copy is exactly
      // the tampering this design exists to prevent.
      if (!p || p.unitPrice === null) {
        droppedVariantIds.push(item.variantId);
        continue;
      }
      const unit = Number(p.unitPrice);
      // Decoration is priced here, from lib/shop/logo.ts, never from the client.
      const logos = item.logos ?? [];
      const decoration = embellishmentCost(logos);
      lines.push({
        lineKey: cartLineKey(item),
        variantId: p.variantId,
        productName: p.productName,
        slug: p.slug,
        image: p.image,
        colourName: p.colourName,
        size: p.size,
        unitPrice: p.unitPrice,
        embellishment: decoration,
        logos,
        qty: item.qty,
        lineTotal: round2((unit + decoration) * item.qty),
        stockQty: p.stockQty,
        co2Kg: p.co2Available && p.co2Kg ? Number(p.co2Kg) : null,
      });
    }

    const settings = await orgSettings(organisationId);
    const total = round2(lines.reduce((s, l) => s + l.lineTotal, 0));

    const co2Total = round2(
      lines.reduce((s, l) => s + (l.co2Kg ?? 0) * l.qty, 0),
    );
    const co2Partial = lines.some((l) => l.co2Kg === null);

    const member = await getMember(user.id, organisationId);
    const quota = member ? await currentQuota(organisationId, member.id) : null;

    const allowance = quota ? Number(quota.allowanceDkk) : 0;
    const used = quota ? Number(quota.usedDkk) : 0;
    const remaining = Math.max(0, round2(allowance - used));

    const onAccount = Math.min(remaining, total);
    const personal = round2(total - onAccount);

    return {
      ok: true,
      lines,
      droppedVariantIds,
      total,
      co2Total,
      co2Partial,
      allowance,
      used,
      remaining,
      hasQuota: quota !== null,
      onAccount: round2(onAccount),
      personal,
      approvalLimit: settings.approvalLimit,
      needsApproval: settings.approvalLimit > 0 && total > settings.approvalLimit,
      personalBlocked: personal > 0 && !settings.allowPersonal,
      displayMode: settings.displayMode,
    };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}

export type PlaceOrderResult =
  | { ok: true; orderNumber: string; needsApproval: boolean }
  | { ok: false; message: string };

/**
 * Creates the order.
 *
 * Re-prices from scratch rather than trusting anything the checkout page showed:
 * the cart could have sat open while an admin changed prices or the assortment.
 *
 * Everything happens in one transaction — an order whose lines failed to insert,
 * or whose allowance was consumed without an order, would both be worse than a
 * failed checkout.
 */
export async function placeOrder(items: CartItem[]): Promise<PlaceOrderResult> {
  try {
    const user = await requireUser();
    if (!user.organisationId) {
      return { ok: false, message: "No organisation on this account" };
    }
    const organisationId = user.organisationId;

    const member = await getMember(user.id, organisationId);
    if (!member) {
      return { ok: false, message: "You are not a member of this organisation" };
    }

    const summary = await priceCart(items);
    if (!summary.ok) return { ok: false, message: summary.message };
    if (summary.lines.length === 0) {
      return { ok: false, message: "Cart is empty" };
    }
    if (summary.personalBlocked) {
      return { ok: false, message: "personalBlocked" };
    }

    const needsApproval = summary.needsApproval;
    const paymentMethod =
      summary.personal > 0 && summary.onAccount > 0
        ? "split"
        : summary.personal > 0
          ? "mobilepay"
          : "account";

    const orderNumber = await db.transaction(async (tx) => {
      const [{ seq }] = await tx.execute<{ seq: string }>(
        sql`select nextval('public.order_number_seq') as seq`,
      );
      const number = `PDT-${new Date().getFullYear()}-${String(seq).padStart(5, "0")}`;

      const [order] = await tx
        .insert(orders)
        .values({
          organisationId,
          memberId: member.id,
          orderNumber: number,
          status: needsApproval ? "pending_approval" : "approved",
          paymentMethod,
          accountAmountDkk: summary.onAccount.toFixed(2),
          personalAmountDkk: summary.personal.toFixed(2),
          totalDkk: summary.total.toFixed(2),
        })
        .returning({ id: orders.id });

      await tx.insert(orderLines).values(
        summary.lines.map((l) => ({
          orderId: order.id,
          organisationId,
          productVariantId: l.variantId,
          quantity: l.qty,
          unitPriceDkk: l.unitPrice,
          logoPlacement: placementColumn(l.logos),
          logoMethod: primaryMethod(l.logos),
          embellishmentCostDkk: (l.embellishment * l.qty).toFixed(2),
          lineTotalDkk: l.lineTotal.toFixed(2),
        })),
      );

      // Reserve the allowance now rather than on approval. Otherwise an employee
      // could stack several pending orders that each fit the budget on their own
      // but not together. Rejection releases it again — see decideApprovalAction.
      if (summary.onAccount > 0) {
        await tx
          .update(employeeQuotas)
          .set({
            usedDkk: sql`${employeeQuotas.usedDkk} + ${summary.onAccount.toFixed(2)}`,
          })
          .where(
            and(
              eq(employeeQuotas.memberId, member.id),
              eq(employeeQuotas.organisationId, organisationId),
            ),
          );
      }

      if (needsApproval) {
        await tx.insert(approvalRequests).values({
          organisationId,
          orderId: order.id,
          requestedBy: member.id,
          status: "pending",
        });
      }

      return number;
    });

    // TODO(payment): when personal > 0 this is where MobilePay is charged.
    // The charge must be idempotent on a payment_intent_id and confirmed by a
    // signed webhook before the order is treated as paid. Until then the amount
    // is recorded on the order and nothing is collected.

    return { ok: true, orderNumber, needsApproval };
  } catch (error) {
    return { ok: false, message: message(error) };
  }
}

/* ------------------------------------------------------------------ */

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function message(error: unknown) {
  if (error instanceof AuthorizationError) return "Not authorised";
  return error instanceof Error ? error.message : "Something went wrong";
}

async function orgSettings(organisationId: string) {
  const [org] = await db
    .select({
      approvalLimit: organisations.orderApprovalLimitDkk,
      allowPersonal: organisations.allowPersonalPurchases,
      displayMode: organisations.displayMode,
    })
    .from(organisations)
    .where(eq(organisations.id, organisationId))
    .limit(1);

  return {
    approvalLimit: org ? Number(org.approvalLimit) : 0,
    allowPersonal: org?.allowPersonal ?? true,
    displayMode: org?.displayMode ?? ("price" as const),
  };
}

async function currentQuota(organisationId: string, memberId: string) {
  const [quota] = await db
    .select({
      id: employeeQuotas.id,
      allowanceDkk: employeeQuotas.allowanceDkk,
      usedDkk: employeeQuotas.usedDkk,
    })
    .from(employeeQuotas)
    .where(
      and(
        eq(employeeQuotas.memberId, memberId),
        eq(employeeQuotas.organisationId, organisationId),
      ),
    )
    .limit(1);
  return quota ?? null;
}

function emptySummary(settings: {
  approvalLimit: number;
  allowPersonal: boolean;
  displayMode: "price" | "points";
}): CartSummary {
  return {
    ok: true,
    lines: [],
    droppedVariantIds: [],
    total: 0,
    co2Total: 0,
    co2Partial: false,
    allowance: 0,
    used: 0,
    remaining: 0,
    hasQuota: false,
    onAccount: 0,
    personal: 0,
    approvalLimit: settings.approvalLimit,
    needsApproval: false,
    personalBlocked: false,
    displayMode: settings.displayMode,
  };
}
