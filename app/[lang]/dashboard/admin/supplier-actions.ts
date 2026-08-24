"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  supplierOrderLines,
  supplierOrders,
  suppliers,
} from "@/lib/db/schema";
import { ROLES } from "@/lib/auth/roles";
import { AuthorizationError, requireRole, requireUser } from "@/lib/auth/guards";
import { listShortfalls } from "@/lib/db/queries/suppliers";

/**
 * Ordre & leverandør.
 *
 * ADMIN ONLY. Releasing a purchase order commits PDT's money; the warehouse
 * reads these screens but does not send them.
 */

export type SupplierCode =
  | "gathered"
  | "nothingToGather"
  | "released"
  | "belowMinimum"
  | "emptyBasket"
  | "notFound"
  | "minimumSaved"
  | "invalid"
  | "denied"
  | "generic";

export type ActionState =
  | { ok: boolean; code: SupplierCode; values?: Record<string, string> }
  | null;

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError) return { ok: false, code: "denied" };
  return { ok: false, code: "generic" };
}

function revalidateSuppliers() {
  revalidatePath("/[lang]/dashboard/admin/supplier-orders", "page");
  revalidatePath("/[lang]/dashboard/admin/suppliers", "page");
}

/**
 * Pools unmet customer demand into each supplier's open basket.
 *
 * Run explicitly rather than on a timer or as a side effect of checkout: an
 * admin can see what it is about to do, and a purchase basket that changes
 * while nobody is looking is one nobody trusts.
 *
 * Safe to run repeatedly — listShortfalls anti-joins against lines already on a
 * purchase order, so a second run adds nothing.
 */
export async function gatherDemandAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  try {
    await requireRole([ROLES.ADMIN]);

    const shortfalls = await listShortfalls();
    if (shortfalls.length === 0) {
      return { ok: true, code: "nothingToGather" };
    }

    const supplierRows = await db
      .select({ id: suppliers.id, code: suppliers.code })
      .from(suppliers)
      .where(eq(suppliers.isActive, true));
    const byCode = new Map(supplierRows.map((s) => [s.code, s.id]));

    let added = 0;
    let skipped = 0;

    await db.transaction(async (tx) => {
      // One open basket per supplier, created on demand. The partial unique
      // index in the schema is what stops two concurrent runs opening two.
      const baskets = new Map<string, string>();

      for (const line of shortfalls) {
        const supplierId = byCode.get(line.supplierCode);
        if (!supplierId) {
          // Catalogue references a supplier nobody has set up yet. Counted and
          // reported rather than silently dropped.
          skipped += 1;
          continue;
        }

        let basketId = baskets.get(supplierId);
        if (!basketId) {
          const [existing] = await tx
            .select({ id: supplierOrders.id })
            .from(supplierOrders)
            .where(
              and(
                eq(supplierOrders.supplierId, supplierId),
                eq(supplierOrders.status, "accumulating"),
              ),
            )
            .limit(1);

          if (existing) {
            basketId = existing.id;
          } else {
            const [created] = await tx
              .insert(supplierOrders)
              .values({ supplierId })
              .returning({ id: supplierOrders.id });
            basketId = created.id;
          }
          baskets.set(supplierId, basketId);
        }

        await tx.insert(supplierOrderLines).values({
          supplierOrderId: basketId,
          productVariantId: line.productVariantId,
          orderLineId: line.orderLineId,
          quantity: line.shortfall,
          unitCostDkk: line.unitCostDkk,
        });
        added += 1;
      }
    });

    revalidateSuppliers();
    return {
      ok: true,
      code: "gathered",
      values: { added: String(added), skipped: String(skipped) },
    };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Sends a supplier's basket.
 *
 * The minimum is enforced here, not just greyed out in the UI: a rush order can
 * override it, but only by ticking `override`, which makes going below an
 * agreed minimum a deliberate act rather than an accidental click.
 *
 * TODO(supplier-integration): this records the release. Actually transmitting
 * it depends on the supplier's channel — EDI for Mascot and Fristads, GraphQL
 * for NWG, a CSV upload for F&H, SFTP for TEE JAYS. Each lands in
 * lib/integrations/<supplier> and is called from here.
 */
export async function releaseBasketAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRole([ROLES.ADMIN]);
    const user = await requireUser();

    const supplierOrderId = String(formData.get("supplierOrderId") ?? "").trim();
    const override = formData.get("override") === "on";
    if (!supplierOrderId) return { ok: false, code: "invalid" };

    const [basket] = await db
      .select({
        id: supplierOrders.id,
        status: supplierOrders.status,
        minimumOrderQty: suppliers.minimumOrderQty,
        supplierName: suppliers.name,
      })
      .from(supplierOrders)
      .innerJoin(suppliers, eq(supplierOrders.supplierId, suppliers.id))
      .where(eq(supplierOrders.id, supplierOrderId))
      .limit(1);

    if (!basket || basket.status !== "accumulating") {
      return { ok: false, code: "notFound" };
    }

    const lines = await db
      .select({ quantity: supplierOrderLines.quantity })
      .from(supplierOrderLines)
      .where(eq(supplierOrderLines.supplierOrderId, supplierOrderId));

    const units = lines.reduce((s, l) => s + l.quantity, 0);
    if (units === 0) return { ok: false, code: "emptyBasket" };

    if (
      basket.minimumOrderQty > 0 &&
      units < basket.minimumOrderQty &&
      !override
    ) {
      return {
        ok: false,
        code: "belowMinimum",
        values: {
          units: String(units),
          minimum: String(basket.minimumOrderQty),
        },
      };
    }

    await db
      .update(supplierOrders)
      .set({
        status: "released",
        releasedAt: new Date(),
        releasedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(supplierOrders.id, supplierOrderId));

    revalidateSuppliers();
    return {
      ok: true,
      code: "released",
      values: { supplier: basket.supplierName, units: String(units) },
    };
  } catch (error) {
    return fail(error);
  }
}

/** The agreed minimum per delivery. 0 means "no minimum agreed". */
export async function setMinimumOrderQtyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRole([ROLES.ADMIN]);

    const supplierId = String(formData.get("supplierId") ?? "").trim();
    const raw = String(formData.get("minimumOrderQty") ?? "").trim();
    const qty = Number(raw);

    if (!supplierId) return { ok: false, code: "invalid" };
    if (!Number.isFinite(qty) || qty < 0 || qty > 100_000) {
      return { ok: false, code: "invalid" };
    }

    await db
      .update(suppliers)
      .set({ minimumOrderQty: Math.round(qty), updatedAt: new Date() })
      .where(eq(suppliers.id, supplierId));

    revalidateSuppliers();
    return {
      ok: true,
      code: "minimumSaved",
      values: { qty: String(Math.round(qty)) },
    };
  } catch (error) {
    return fail(error);
  }
}
