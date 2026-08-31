import "server-only";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  orderLines,
  orders,
  organisationMembers,
  organisations,
  productVariants,
  products,
} from "@/lib/db/schema";
import { STAGES, expectedDispatch, type Stage } from "@/lib/production";

/**
 * Queries behind Produktionsflow and Pak & send.
 *
 * Both screens read the SAME orders — one groups them into board columns, the
 * other lists what the warehouse has to physically do. There is no separate
 * production table, so the two can never disagree about where an order is.
 */

export type BoardCard = {
  id: string;
  orderNumber: string;
  status: Stage;
  customer: string;
  /** Who ordered it — blank on orders placed before members carried names. */
  placedBy: string | null;
  units: number;
  lines: number;
  totalDkk: string;
  /** True when any line carries a logo, i.e. it must pass through print. */
  needsDecoration: boolean;
  placedAt: Date;
  dueAt: Date;
  /** Set when the parcel left — dispatch is an event, not a stage (Q-C2 c). */
  dispatchedAt: Date | null;
  glsParcelNumber: string | null;
};

/** Every order currently somewhere in fulfilment, newest first per column. */
export async function listBoardCards(limit = 200): Promise<BoardCard[]> {
  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      totalDkk: orders.totalDkk,
      createdAt: orders.createdAt,
      dispatchedAt: orders.dispatchedAt,
      glsParcelNumber: orders.glsParcelNumber,
      customer: organisations.name,
      placedBy: organisationMembers.fullName,
      units: sql<number>`coalesce(sum(${orderLines.quantity}), 0)::int`,
      lines: sql<number>`count(${orderLines.id})::int`,
      decorated: sql<number>`count(${orderLines.logoPlacement})::int`,
    })
    .from(orders)
    .innerJoin(organisations, eq(orders.organisationId, organisations.id))
    .leftJoin(
      organisationMembers,
      eq(orders.memberId, organisationMembers.id),
    )
    .leftJoin(orderLines, eq(orderLines.orderId, orders.id))
    .where(inArray(orders.status, [...STAGES]))
    .groupBy(orders.id, organisations.name, organisationMembers.fullName)
    .orderBy(asc(orders.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    orderNumber: r.orderNumber,
    // Safe: the WHERE clause restricts to exactly the board stages.
    status: r.status as Stage,
    customer: r.customer,
    placedBy: r.placedBy,
    units: r.units,
    lines: r.lines,
    totalDkk: r.totalDkk,
    needsDecoration: r.decorated > 0,
    placedAt: r.createdAt,
    dueAt: expectedDispatch(r.createdAt),
    dispatchedAt: r.dispatchedAt,
    glsParcelNumber: r.glsParcelNumber,
  }));
}

export type BoardColumn = { stage: Stage; cards: BoardCard[] };

/** Groups cards into board columns, preserving stage order. */
export function toColumns(cards: BoardCard[]): BoardColumn[] {
  return STAGES.map((stage) => ({
    stage,
    cards: cards.filter((c) => c.status === stage),
  }));
}

export type PackLine = {
  id: string;
  productName: string;
  /**
   * The supplier's article number. What a picker reads off the garment's own
   * label and what PDT quotes back when re-ordering — a colour name and a size
   * are not enough to identify a garment in a warehouse.
   */
  sku: string | null;
  colourName: string | null;
  size: string | null;
  quantity: number;
  logoPlacement: string | null;
  logoMethod: "embroidery" | "print" | "transfer" | null;
  /** Supplier stock for this variant right now. Meaningless when untracked. */
  stockQty: number;
  /** False when stock will not cover the line — it is waiting on a delivery. */
  available: boolean;
  /**
   * False when the supplier publishes no stock figures at all.
   *
   * The picker still cannot take these off a shelf, but the reason is different
   * and the screen must say so: "bestilles hjem" is a normal step, whereas
   * "waiting — 0 in stock" reads as something having gone wrong.
   */
  stockTracked: boolean;
};

export type PackOrder = {
  id: string;
  orderNumber: string;
  status: Stage;
  customer: string;
  placedAt: Date;
  dueAt: Date;
  glsParcelNumber: string | null;
  glsTrackUrl: string | null;
  /** Set once the parcel has been handed to GLS; the order does not move. */
  dispatchedAt: Date | null;
  units: number;
  needsDecoration: boolean;
  /** True only when every line can be picked today. */
  readyToPick: boolean;
  lines: PackLine[];
};

/**
 * The warehouse queue: orders that still need physical work, with their lines.
 *
 * Line availability is computed from live variant stock rather than stored on
 * the order. Stock moves between the order being placed and the picker walking
 * the aisle, and a flag written at checkout would be a week stale by then.
 *
 * `delivered` is excluded — nothing left to do. Dispatched orders are NOT
 * excluded: under Q-C2 (c) dispatch does not move an order, so a parcel handed
 * to GLS this morning is still in `sent_to_print` and still on this list, with
 * its parcel number, until somebody confirms it arrived.
 */
export async function listPackQueue(limit = 60): Promise<PackOrder[]> {
  const heads = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      createdAt: orders.createdAt,
      glsParcelNumber: orders.glsParcelNumber,
      glsTrackUrl: orders.glsTrackUrl,
      dispatchedAt: orders.dispatchedAt,
      customer: organisations.name,
    })
    .from(orders)
    .innerJoin(organisations, eq(orders.organisationId, organisations.id))
    .where(
      inArray(orders.status, ["booked", "arrived_at_warehouse", "sent_to_print"]),
    )
    .orderBy(desc(orders.createdAt))
    .limit(limit);

  if (heads.length === 0) return [];

  const lines = await db
    .select({
      id: orderLines.id,
      orderId: orderLines.orderId,
      quantity: orderLines.quantity,
      logoPlacement: orderLines.logoPlacement,
      logoMethod: orderLines.logoMethod,
      productName: products.name,
      colourName: productVariants.colourName,
      size: productVariants.size,
      sku: productVariants.sku,
      stockQty: productVariants.stockQty,
      stockTracked: productVariants.stockTracked,
      /*
       * What earlier orders have already claimed of this variant.
       *
       * Checkout refuses to oversell, so this is normally 0 for the order at the
       * front of the queue. It stops being 0 when the supplier's feed REVISES
       * STOCK DOWN after orders were taken — the one case placement-time checks
       * cannot prevent, and the case a picker needs to be warned about.
       *
       * "Earlier" is by placement time, so the queue is first-come-first-served
       * and two pickers reading the same screen see the same answer.
       */
      committedAhead: sql<number>`
        coalesce((
          select sum(other.quantity)
            from order_lines other
            join orders oo on oo.id = other.order_id
           where other.product_variant_id = ${orderLines.productVariantId}
             and other.id <> ${orderLines.id}
             and oo.status in ('pending_approval', 'booked', 'arrived_at_warehouse', 'sent_to_print')
             and oo.dispatched_at is null
             and (oo.created_at, oo.id) < (${orders.createdAt}, ${orders.id})
        ), 0)::int
      `,
    })
    .from(orderLines)
    .innerJoin(orders, eq(orderLines.orderId, orders.id))
    .innerJoin(
      productVariants,
      eq(orderLines.productVariantId, productVariants.id),
    )
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(
      inArray(
        orderLines.orderId,
        heads.map((h) => h.id),
      ),
    );

  const byOrder = new Map<string, PackLine[]>();
  for (const l of lines) {
    const list = byOrder.get(l.orderId) ?? [];
    list.push({
      id: l.id,
      productName: l.productName,
      colourName: l.colourName,
      size: l.size,
      sku: l.sku,
      quantity: l.quantity,
      logoPlacement: l.logoPlacement,
      logoMethod: l.logoMethod,
      stockQty: l.stockQty,
      stockTracked: l.stockTracked,
      // An untracked variant is never "in stock" here: the goods are bought in
      // per order, so the honest state is awaiting delivery, not on the shelf.
      available: l.stockTracked && l.stockQty - l.committedAhead >= l.quantity,
    });
    byOrder.set(l.orderId, list);
  }

  return heads.map((h) => {
    const orderLinesForOrder = byOrder.get(h.id) ?? [];
    return {
      id: h.id,
      orderNumber: h.orderNumber,
      status: h.status as Stage,
      customer: h.customer,
      placedAt: h.createdAt,
      dueAt: expectedDispatch(h.createdAt),
      glsParcelNumber: h.glsParcelNumber,
      glsTrackUrl: h.glsTrackUrl,
      dispatchedAt: h.dispatchedAt,
      units: orderLinesForOrder.reduce((s, l) => s + l.quantity, 0),
      needsDecoration: orderLinesForOrder.some((l) => l.logoPlacement !== null),
      readyToPick:
        orderLinesForOrder.length > 0 &&
        orderLinesForOrder.every((l) => l.available),
      lines: orderLinesForOrder,
    };
  });
}

/** One order's stage, for actions that need to check a transition is legal. */
export async function getOrderStage(
  orderId: string,
): Promise<{ status: string; orderNumber: string } | null> {
  const [row] = await db
    .select({ status: orders.status, orderNumber: orders.orderNumber })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return row ?? null;
}

/**
 * Counts for the board headline, measured on the same cards it renders.
 *
 * "Active" means still owed work: a dispatched order is off PDT's desk even
 * though its stage has not changed, so it is read from the timestamp rather
 * than from the status.
 */
export function boardSummary(cards: BoardCard[], now = new Date()) {
  const active = cards.filter(
    (c) => c.status !== "delivered" && c.dispatchedAt === null,
  );
  const late = active.filter((c) => c.dueAt.getTime() < now.getTime());
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const dueThisWeek = active.filter(
    (c) => c.dueAt.getTime() >= now.getTime() && c.dueAt.getTime() <= weekEnd.getTime(),
  );

  return {
    active: active.length,
    units: active.reduce((s, c) => s + c.units, 0),
    late: late.length,
    dueThisWeek: dueThisWeek.length,
    dispatched: cards.filter(
      (c) => c.dispatchedAt !== null && c.status !== "delivered",
    ).length,
    delivered: cards.filter((c) => c.status === "delivered").length,
  };
}
