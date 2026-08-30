import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  orderLines,
  orders,
  organisations,
  productVariants,
  products,
  supplierOrderLines,
  supplierOrders,
  suppliers,
} from "@/lib/db/schema";

/**
 * Queries behind Leverandører and Ordre & leverandør.
 *
 * The accumulator is the point of this screen: a customer orders two jackets,
 * the supplier will not ship fewer than twenty-five, so demand is pooled across
 * customers until the minimum is met. Everything here is about answering "what
 * do we owe, to whom, and can we send it yet".
 */

export type SupplierRow = {
  id: string;
  code: string;
  name: string;
  productGroup: string | null;
  orderChannel:
    | "api"
    | "graphql"
    | "edi"
    | "ftp"
    | "sftp"
    | "portal"
    | "csv"
    | "email";
  dataChannel: string | null;
  minimumOrderQty: number;
  leadTimeDays: number;
  notes: string | null;
  productCount: number;
  /** Units sitting in this supplier's open basket right now. */
  openUnits: number;
};

export async function listSuppliers(): Promise<SupplierRow[]> {
  const rows = await db
    .select({
      id: suppliers.id,
      code: suppliers.code,
      name: suppliers.name,
      productGroup: suppliers.productGroup,
      orderChannel: suppliers.orderChannel,
      dataChannel: suppliers.dataChannel,
      minimumOrderQty: suppliers.minimumOrderQty,
      leadTimeDays: suppliers.leadTimeDays,
      notes: suppliers.notes,
    })
    .from(suppliers)
    .where(eq(suppliers.isActive, true))
    .orderBy(asc(suppliers.name));

  // Counted separately rather than as correlated subselects: two grouped
  // queries merged in JS is easier to verify than a subquery read twice.
  const [counts, open] = await Promise.all([
    db
      .select({
        supplierId: products.supplierId,
        count: sql<number>`count(*)::int`,
      })
      .from(products)
      .where(eq(products.isActive, true))
      .groupBy(products.supplierId),

    db
      .select({
        supplierId: supplierOrders.supplierId,
        units: sql<number>`coalesce(sum(${supplierOrderLines.quantity}), 0)::int`,
      })
      .from(supplierOrders)
      .leftJoin(
        supplierOrderLines,
        eq(supplierOrderLines.supplierOrderId, supplierOrders.id),
      )
      .where(eq(supplierOrders.status, "accumulating"))
      .groupBy(supplierOrders.supplierId),
  ]);

  const byCode = new Map(counts.map((c) => [c.supplierId, c.count]));
  const byId = new Map(open.map((o) => [o.supplierId, o.units]));

  return rows.map((r) => ({
    ...r,
    productCount: byCode.get(r.code) ?? 0,
    openUnits: byId.get(r.id) ?? 0,
  }));
}

export type BasketLine = {
  id: string;
  quantity: number;
  productName: string;
  colourName: string | null;
  size: string | null;
  unitCostDkk: string | null;
  /** The customer this demand came from, blank when buying for stock. */
  customer: string | null;
  orderNumber: string | null;
};

export type SupplierBasket = {
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  orderChannel: SupplierRow["orderChannel"];
  minimumOrderQty: number;
  leadTimeDays: number;
  /** Null when this supplier has no open basket yet. */
  supplierOrderId: string | null;
  units: number;
  valueDkk: number;
  lines: BasketLine[];
  /** Whether the supplier's minimum is met. Always true when there is none. */
  meetsMinimum: boolean;
};

/** Every supplier's open basket, including empty ones, for the accumulator. */
export async function listBaskets(): Promise<SupplierBasket[]> {
  const rows = await db
    .select({
      supplierId: suppliers.id,
      supplierName: suppliers.name,
      supplierCode: suppliers.code,
      orderChannel: suppliers.orderChannel,
      minimumOrderQty: suppliers.minimumOrderQty,
      leadTimeDays: suppliers.leadTimeDays,
      supplierOrderId: supplierOrders.id,
    })
    .from(suppliers)
    .leftJoin(
      supplierOrders,
      and(
        eq(supplierOrders.supplierId, suppliers.id),
        eq(supplierOrders.status, "accumulating"),
      ),
    )
    .where(eq(suppliers.isActive, true))
    .orderBy(asc(suppliers.name));

  const openIds = rows
    .map((r) => r.supplierOrderId)
    .filter((id): id is string => id !== null);

  const lines = openIds.length
    ? await db
        .select({
          id: supplierOrderLines.id,
          supplierOrderId: supplierOrderLines.supplierOrderId,
          quantity: supplierOrderLines.quantity,
          unitCostDkk: supplierOrderLines.unitCostDkk,
          productName: products.name,
          colourName: productVariants.colourName,
          size: productVariants.size,
          customer: organisations.name,
          orderNumber: orders.orderNumber,
        })
        .from(supplierOrderLines)
        .innerJoin(
          productVariants,
          eq(supplierOrderLines.productVariantId, productVariants.id),
        )
        .innerJoin(products, eq(productVariants.productId, products.id))
        .leftJoin(orderLines, eq(supplierOrderLines.orderLineId, orderLines.id))
        .leftJoin(orders, eq(orderLines.orderId, orders.id))
        .leftJoin(organisations, eq(orders.organisationId, organisations.id))
        .where(inArray(supplierOrderLines.supplierOrderId, openIds))
        .orderBy(desc(supplierOrderLines.createdAt))
    : [];

  const byOrder = new Map<string, BasketLine[]>();
  for (const l of lines) {
    const list = byOrder.get(l.supplierOrderId) ?? [];
    list.push({
      id: l.id,
      quantity: l.quantity,
      productName: l.productName,
      colourName: l.colourName,
      size: l.size,
      unitCostDkk: l.unitCostDkk,
      customer: l.customer,
      orderNumber: l.orderNumber,
    });
    byOrder.set(l.supplierOrderId, list);
  }

  return rows.map((r) => {
    const basket = r.supplierOrderId ? (byOrder.get(r.supplierOrderId) ?? []) : [];
    const units = basket.reduce((s, l) => s + l.quantity, 0);
    const valueDkk = basket.reduce(
      (s, l) => s + Number(l.unitCostDkk ?? 0) * l.quantity,
      0,
    );

    return {
      supplierId: r.supplierId,
      supplierName: r.supplierName,
      supplierCode: r.supplierCode,
      orderChannel: r.orderChannel,
      minimumOrderQty: r.minimumOrderQty,
      leadTimeDays: r.leadTimeDays,
      supplierOrderId: r.supplierOrderId,
      units,
      valueDkk: Math.round(valueDkk * 100) / 100,
      lines: basket,
      // No agreed minimum means nothing to wait for.
      meetsMinimum: r.minimumOrderQty <= 0 || units >= r.minimumOrderQty,
    };
  });
}

export type ShortfallLine = {
  orderLineId: string;
  orderNumber: string;
  customer: string;
  productVariantId: string;
  productName: string;
  colourName: string | null;
  size: string | null;
  supplierCode: string;
  /** Units the customer ordered. */
  ordered: number;
  stockQty: number;
  /** Units PDT has to buy to cover this line. */
  shortfall: number;
  unitCostDkk: string | null;
};

/**
 * Customer demand that stock cannot cover and that is not already on a
 * purchase order.
 *
 * Only orders still in fulfilment count — a delivered order's shortfall was
 * either resolved or is somebody's complaint, not something to buy now.
 *
 * The `isNull(supplierOrderLines.id)` anti-join is what makes gathering demand
 * safe to run twice: a line already sitting in a basket is not counted again.
 */
export async function listShortfalls(): Promise<ShortfallLine[]> {
  const rows = await db
    .select({
      orderLineId: orderLines.id,
      orderNumber: orders.orderNumber,
      customer: organisations.name,
      productVariantId: productVariants.id,
      productName: products.name,
      colourName: productVariants.colourName,
      size: productVariants.size,
      supplierCode: products.supplierId,
      ordered: orderLines.quantity,
      stockQty: productVariants.stockQty,
      unitCostDkk: sql<
        string | null
      >`coalesce(${productVariants.netPriceDkk}, ${productVariants.listPriceDkk})`,
    })
    .from(orderLines)
    .innerJoin(orders, eq(orderLines.orderId, orders.id))
    .innerJoin(organisations, eq(orders.organisationId, organisations.id))
    .innerJoin(
      productVariants,
      eq(orderLines.productVariantId, productVariants.id),
    )
    .innerJoin(products, eq(productVariants.productId, products.id))
    .leftJoin(
      supplierOrderLines,
      eq(supplierOrderLines.orderLineId, orderLines.id),
    )
    .where(
      and(
        inArray(orders.status, ["booked", "arrived_at_warehouse", "sent_to_print"]),
        isNull(supplierOrderLines.id),
        sql`${productVariants.stockQty} < ${orderLines.quantity}`,
      ),
    )
    .orderBy(asc(orders.createdAt))
    .limit(500);

  return rows.map((r) => ({
    ...r,
    shortfall: Math.max(0, r.ordered - r.stockQty),
  }));
}

export type ReleasedOrder = {
  id: string;
  supplierName: string;
  orderChannel: SupplierRow["orderChannel"];
  status: "released" | "confirmed" | "received" | "cancelled" | "ready";
  reference: string | null;
  releasedAt: Date | null;
  units: number;
};

/** Purchase orders already sent, newest first. */
export async function listReleasedOrders(limit = 25): Promise<ReleasedOrder[]> {
  const rows = await db
    .select({
      id: supplierOrders.id,
      supplierName: suppliers.name,
      orderChannel: suppliers.orderChannel,
      status: supplierOrders.status,
      reference: supplierOrders.reference,
      releasedAt: supplierOrders.releasedAt,
      units: sql<number>`coalesce(sum(${supplierOrderLines.quantity}), 0)::int`,
    })
    .from(supplierOrders)
    .innerJoin(suppliers, eq(supplierOrders.supplierId, suppliers.id))
    .leftJoin(
      supplierOrderLines,
      eq(supplierOrderLines.supplierOrderId, supplierOrders.id),
    )
    .where(
      inArray(supplierOrders.status, [
        "released",
        "confirmed",
        "received",
        "cancelled",
      ]),
    )
    .groupBy(
      supplierOrders.id,
      suppliers.name,
      suppliers.orderChannel,
      supplierOrders.status,
      supplierOrders.reference,
      supplierOrders.releasedAt,
    )
    .orderBy(desc(supplierOrders.releasedAt))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    status: r.status as ReleasedOrder["status"],
  }));
}
