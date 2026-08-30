"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { ROLES } from "@/lib/auth/roles";
import { AuthorizationError, requireRole } from "@/lib/auth/guards";
import { canDispatch, canMove, isStage, requiresDispatch } from "@/lib/production";

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
  | "dispatched"
  | "notFound"
  | "movedOn"
  | "needsDispatch"
  | "invalidParcel"
  | "cannotDispatch"
  | "alreadyDispatched"
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
 * hand-typed code and strict enough that an empty scan cannot record a
 * dispatch — the case that loses a parcel.
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
      .select({
        status: orders.status,
        orderNumber: orders.orderNumber,
        dispatchedAt: orders.dispatchedAt,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!current) return { ok: false, code: "notFound" };
    if (!isStage(current.status)) return { ok: false, code: "invalid" };
    if (!canMove(current.status, to)) {
      // Almost always means someone else moved it while this page was open.
      return { ok: false, code: "movedOn" };
    }
    // Delivered is the customer having the parcel, so there has to be a parcel.
    if (requiresDispatch(to) && current.dispatchedAt === null) {
      return { ok: false, code: "needsDispatch" };
    }

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
 * Dispatch — an EVENT, not a stage.
 *
 * Q-C2 (c): the parcel number, the tracking URL and the dispatch timestamp are
 * stamped on the order WITHOUT moving it. That is what keeps D-3's four stages
 * intact and "Leveret" honest: the order stays where it is until somebody can
 * say the customer actually received it.
 *
 * Separate from moveOrderAction because this is the one moment that carries
 * data. A parcel recorded as sent without a tracking number is a parcel nobody
 * can find, so the number is required and the writes happen together.
 *
 * TODO(invoice): D-5 puts the invoice here — raised when the GLS label is
 * created, not at checkout and not in a nightly batch. There is no `invoices`
 * table and no e-conomic client yet, so the trigger is named rather than faked.
 *
 * TODO(gls): the tracking URL is built from GLS's public pattern. When the GLS
 * API is wired up, book the label here and take the number back from the
 * response instead of typing it in — and let the delivery webhook, not a
 * person, set `delivered`.
 */
export async function dispatchOrderAction(
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
      .select({
        status: orders.status,
        orderNumber: orders.orderNumber,
        dispatchedAt: orders.dispatchedAt,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!current) return { ok: false, code: "notFound" };
    // Dispatching twice would overwrite the first parcel number and, once the
    // invoice hangs off this action, raise a second invoice.
    if (current.dispatchedAt !== null) {
      return { ok: false, code: "alreadyDispatched" };
    }
    if (!isStage(current.status) || !canDispatch(current.status)) {
      return { ok: false, code: "cannotDispatch" };
    }

    await db
      .update(orders)
      .set({
        glsParcelNumber: parcel,
        glsTrackUrl: `https://gls-group.eu/DK/da/find-pakke?match=${encodeURIComponent(parcel)}`,
        dispatchedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    revalidateFulfilment();
    return {
      ok: true,
      code: "dispatched",
      values: { order: current.orderNumber, parcel },
    };
  } catch (error) {
    return fail(error);
  }
}
