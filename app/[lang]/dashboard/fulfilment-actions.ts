"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { ROLES } from "@/lib/auth/roles";
import { AuthorizationError, requireRole } from "@/lib/auth/guards";
import { canMove, isStage, requiresParcelNumber } from "@/lib/production";

/**
 * Moving an order through fulfilment.
 *
 * Shared by Produktionsflow (platform admin) and Pak & send (warehouse),
 * because they are two views of one pipeline. Both roles may move an order;
 * neither may invent a transition — `canMove` is checked here on the server,
 * with the order's CURRENT stage read from the database rather than taken from
 * whatever the page was showing when the button was drawn.
 */

/**
 * Actions return a CODE, not a sentence.
 *
 * Both screens are bilingual, and a Server Action has no locale of its own —
 * returning "Ugyldig GLS-kode" server-side put Danish on the English page. The
 * caller looks the code up in its own dictionary and fills in `values`.
 */
export type FulfilmentCode =
  | "moved"
  | "shipped"
  | "notFound"
  | "movedOn"
  | "needsParcel"
  | "invalidParcel"
  | "cannotShip"
  | "invalid"
  | "denied"
  | "generic";

export type ActionState =
  | { ok: boolean; code: FulfilmentCode; values?: Record<string, string> }
  | null;

const FULFILMENT_ROLES = [ROLES.WAREHOUSE, ROLES.ADMIN] as const;

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError) return { ok: false, code: "denied" };
  return { ok: false, code: "generic" };
}

function revalidateFulfilment() {
  revalidatePath("/[lang]/dashboard/admin/production", "page");
  revalidatePath("/[lang]/dashboard/warehouse", "page");
}

/**
 * GLS parcel numbers are 11–20 digits in practice. Kept loose enough for a
 * hand-typed code and strict enough that an empty scan cannot mark an order
 * shipped — the case that loses a parcel.
 */
const PARCEL_PATTERN = /^[A-Za-z0-9-]{6,32}$/;

export async function moveOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRole([...FULFILMENT_ROLES]);

    const orderId = String(formData.get("orderId") ?? "").trim();
    const to = String(formData.get("to") ?? "").trim();

    if (!orderId || !isStage(to)) return { ok: false, code: "invalid" };

    const [current] = await db
      .select({ status: orders.status, orderNumber: orders.orderNumber })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!current) return { ok: false, code: "notFound" };
    if (!isStage(current.status)) return { ok: false, code: "invalid" };
    if (!canMove(current.status, to)) {
      // Almost always means someone else moved it while this page was open.
      return { ok: false, code: "movedOn" };
    }
    if (requiresParcelNumber(to)) return { ok: false, code: "needsParcel" };

    await db
      .update(orders)
      .set({ status: to, updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    revalidateFulfilment();
    return {
      ok: true,
      code: "moved",
      values: { order: current.orderNumber },
    };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Dispatch: records the parcel number and moves the order to `shipped`.
 *
 * Separate from moveOrderAction because shipping is the one transition that
 * carries data. A parcel marked sent without a tracking number is a parcel
 * nobody can find, so the number is required and the two writes happen together.
 *
 * TODO(gls): the tracking URL is built from GLS's public pattern. When the GLS
 * API is wired up, book the label here and take the number back from the
 * response instead of typing it in.
 */
export async function shipOrderAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRole([...FULFILMENT_ROLES]);

    const orderId = String(formData.get("orderId") ?? "").trim();
    const parcel = String(formData.get("parcelNumber") ?? "").trim();

    if (!orderId) return { ok: false, code: "invalid" };
    if (!PARCEL_PATTERN.test(parcel)) {
      return { ok: false, code: "invalidParcel" };
    }

    const [current] = await db
      .select({ status: orders.status, orderNumber: orders.orderNumber })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!current) return { ok: false, code: "notFound" };
    if (!isStage(current.status) || !canMove(current.status, "shipped")) {
      return { ok: false, code: "cannotShip" };
    }

    await db
      .update(orders)
      .set({
        status: "shipped",
        glsParcelNumber: parcel,
        glsTrackUrl: `https://gls-group.eu/DK/da/find-pakke?match=${encodeURIComponent(parcel)}`,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    revalidateFulfilment();
    return {
      ok: true,
      code: "shipped",
      values: { order: current.orderNumber, parcel },
    };
  } catch (error) {
    return fail(error);
  }
}
