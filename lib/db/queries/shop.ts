import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  employeeQuotas,
  orderLines,
  orders,
  orgAssortment,
  orgPricing,
  organisationMembers,
  organisations,
  productVariants,
  products,
} from "@/lib/db/schema";

/**
 * Shop queries.
 *
 * Everything joins through org_assortment and org_pricing, so an employee only
 * ever sees the products their organisation has enabled, at their organisation's
 * price. Drizzle bypasses RLS, so that scoping is the boundary — see lib/db/index.ts.
 */

export type ShopProduct = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  primaryImage: string | null;
  co2Kg: string | null;
  co2Available: boolean;
  fromPrice: string | null;
  stockQty: number;
};

/** Catalogue for one organisation, cheapest variant price per product. */
export async function listShopProducts(
  organisationId: string,
  category?: string,
): Promise<ShopProduct[]> {
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      brand: products.brand,
      category: products.category,
      primaryImage: products.primaryImage,
      co2Kg: products.co2Kg,
      co2Available: products.co2Available,
      fromPrice: sql<string | null>`min(${orgPricing.priceDkk})`,
      stockQty: sql<number>`coalesce(sum(${productVariants.stockQty}), 0)::int`,
    })
    .from(orgAssortment)
    .innerJoin(products, eq(orgAssortment.productId, products.id))
    .leftJoin(
      productVariants,
      and(
        eq(productVariants.productId, products.id),
        eq(productVariants.isActive, true),
      ),
    )
    .leftJoin(
      orgPricing,
      and(
        eq(orgPricing.productVariantId, productVariants.id),
        eq(orgPricing.organisationId, organisationId),
      ),
    )
    .where(
      and(
        eq(orgAssortment.organisationId, organisationId),
        eq(orgAssortment.isEnabled, true),
        eq(products.isActive, true),
        category ? eq(products.category, category) : undefined,
      ),
    )
    .groupBy(products.id)
    .orderBy(asc(products.name))
    .limit(200);

  return rows;
}

export async function listShopCategories(organisationId: string) {
  const rows = await db
    .select({
      category: products.category,
      count: sql<number>`count(*)::int`,
    })
    .from(orgAssortment)
    .innerJoin(products, eq(orgAssortment.productId, products.id))
    .where(
      and(
        eq(orgAssortment.organisationId, organisationId),
        eq(orgAssortment.isEnabled, true),
        eq(products.isActive, true),
      ),
    )
    .groupBy(products.category)
    .orderBy(asc(products.category));
  return rows;
}

/** One product with every variant the organisation may buy, at its own price. */
export async function getShopProduct(organisationId: string, slug: string) {
  const [product] = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      brand: products.brand,
      category: products.category,
      material: products.material,
      primaryImage: products.primaryImage,
      co2Kg: products.co2Kg,
      co2Available: products.co2Available,
    })
    .from(orgAssortment)
    .innerJoin(products, eq(orgAssortment.productId, products.id))
    .where(
      and(
        eq(orgAssortment.organisationId, organisationId),
        eq(orgAssortment.isEnabled, true),
        eq(products.slug, slug),
        eq(products.isActive, true),
      ),
    )
    .limit(1);

  if (!product) return null;

  const variants = await db
    .select({
      id: productVariants.id,
      colourName: productVariants.colourName,
      colourHex: productVariants.colourHex,
      size: productVariants.size,
      ean: productVariants.ean,
      stockQty: productVariants.stockQty,
      stockUpdatedAt: productVariants.stockUpdatedAt,
      priceDkk: orgPricing.priceDkk,
      listPriceDkk: productVariants.listPriceDkk,
    })
    .from(productVariants)
    .leftJoin(
      orgPricing,
      and(
        eq(orgPricing.productVariantId, productVariants.id),
        eq(orgPricing.organisationId, organisationId),
      ),
    )
    .where(
      and(
        eq(productVariants.productId, product.id),
        eq(productVariants.isActive, true),
      ),
    )
    .orderBy(asc(productVariants.colourName), asc(productVariants.size));

  return { product, variants };
}

export type PricedLine = {
  variantId: string;
  productName: string;
  slug: string;
  image: string | null;
  colourName: string | null;
  size: string | null;
  unitPrice: string;
  stockQty: number;
  co2Kg: string | null;
  co2Available: boolean;
};

/**
 * Prices a set of variant ids for an organisation.
 *
 * This is the single source of truth for what anything costs. The browser sends
 * variant ids and quantities only; whatever price it thinks applies is ignored.
 * A variant missing from this result is not in the organisation's assortment and
 * must be dropped from the cart rather than silently priced.
 */
export async function priceVariants(
  organisationId: string,
  variantIds: string[],
): Promise<PricedLine[]> {
  if (variantIds.length === 0) return [];

  return db
    .select({
      variantId: productVariants.id,
      productName: products.name,
      slug: products.slug,
      image: products.primaryImage,
      colourName: productVariants.colourName,
      size: productVariants.size,
      unitPrice: orgPricing.priceDkk,
      stockQty: productVariants.stockQty,
      co2Kg: products.co2Kg,
      co2Available: products.co2Available,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .innerJoin(
      orgAssortment,
      and(
        eq(orgAssortment.productId, products.id),
        eq(orgAssortment.organisationId, organisationId),
        eq(orgAssortment.isEnabled, true),
      ),
    )
    .innerJoin(
      orgPricing,
      and(
        eq(orgPricing.productVariantId, productVariants.id),
        eq(orgPricing.organisationId, organisationId),
      ),
    )
    .where(
      and(
        inArray(productVariants.id, variantIds),
        eq(productVariants.isActive, true),
        eq(products.isActive, true),
      ),
    );
}

/** The caller's own membership row, needed to attribute orders and quotas. */
export async function getMember(userId: string, organisationId: string) {
  const [member] = await db
    .select({
      id: organisationMembers.id,
      fullName: organisationMembers.fullName,
      departmentId: organisationMembers.departmentId,
      measurements: organisationMembers.measurements,
    })
    .from(organisationMembers)
    .where(
      and(
        eq(organisationMembers.userId, userId),
        eq(organisationMembers.organisationId, organisationId),
      ),
    )
    .limit(1);
  return member ?? null;
}

/** Only this employee's own orders. */
export async function listMyOrders(memberId: string, organisationId: string) {
  return db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      totalDkk: orders.totalDkk,
      accountAmountDkk: orders.accountAmountDkk,
      personalAmountDkk: orders.personalAmountDkk,
      createdAt: orders.createdAt,
      glsTrackUrl: orders.glsTrackUrl,
    })
    .from(orders)
    .where(
      and(
        eq(orders.memberId, memberId),
        eq(orders.organisationId, organisationId),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(100);
}

export async function getMyOrder(
  memberId: string,
  organisationId: string,
  orderNumber: string,
) {
  const [order] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.orderNumber, orderNumber),
        // Scoped to the caller: an employee guessing another order number gets
        // nothing rather than someone else's basket.
        eq(orders.memberId, memberId),
        eq(orders.organisationId, organisationId),
      ),
    )
    .limit(1);

  if (!order) return null;

  const lines = await db
    .select({
      id: orderLines.id,
      quantity: orderLines.quantity,
      unitPriceDkk: orderLines.unitPriceDkk,
      lineTotalDkk: orderLines.lineTotalDkk,
      productName: products.name,
      slug: products.slug,
      image: products.primaryImage,
      colourName: productVariants.colourName,
      size: productVariants.size,
    })
    .from(orderLines)
    .innerJoin(
      productVariants,
      eq(orderLines.productVariantId, productVariants.id),
    )
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(orderLines.orderId, order.id));

  return { order, lines };
}

/* ------------------------------------------------------------------ *
 * Employee self-service: allowance, size history, reordering.
 * ------------------------------------------------------------------ */

export type AllowanceSummary = {
  allowance: number;
  used: number;
  remaining: number;
  pct: number;
  hasQuota: boolean;
  displayMode: "price" | "points";
  approvalLimit: number;
  periodEnd: string | null;
};

/**
 * What the employee has left to spend, plus how their organisation wants it
 * shown. One query behind the shop's balance bar and the account page, so the
 * two can never disagree.
 */
export async function getAllowanceSummary(
  organisationId: string,
  memberId: string | null,
): Promise<AllowanceSummary> {
  const [org] = await db
    .select({
      displayMode: organisations.displayMode,
      approvalLimit: organisations.orderApprovalLimitDkk,
    })
    .from(organisations)
    .where(eq(organisations.id, organisationId))
    .limit(1);

  const quota = memberId
    ? (
        await db
          .select({
            allowanceDkk: employeeQuotas.allowanceDkk,
            usedDkk: employeeQuotas.usedDkk,
            periodEnd: employeeQuotas.periodEnd,
          })
          .from(employeeQuotas)
          .where(
            and(
              eq(employeeQuotas.memberId, memberId),
              eq(employeeQuotas.organisationId, organisationId),
            ),
          )
          .orderBy(desc(employeeQuotas.periodStart))
          .limit(1)
      )[0]
    : undefined;

  const allowance = quota ? Number(quota.allowanceDkk) : 0;
  const used = quota ? Number(quota.usedDkk) : 0;
  const remaining = Math.max(0, Math.round((allowance - used) * 100) / 100);

  return {
    allowance,
    used,
    remaining,
    pct: allowance > 0 ? Math.min(100, Math.round((used / allowance) * 100)) : 0,
    hasQuota: quota !== undefined,
    displayMode: org?.displayMode ?? "price",
    approvalLimit: org ? Number(org.approvalLimit) : 0,
    periodEnd: quota?.periodEnd ?? null,
  };
}

/**
 * The size this employee last ordered, per product.
 *
 * Drives the "Sidst bestilt: XL" badge and the pre-selected size. What somebody
 * actually wore and kept beats any size table, so it takes precedence in
 * lib/shop/sizing.ts.
 */
export async function listLastOrderedSizes(
  organisationId: string,
  memberId: string,
): Promise<Map<string, string>> {
  const rows = await db
    .select({
      productId: products.id,
      size: productVariants.size,
      createdAt: orders.createdAt,
    })
    .from(orderLines)
    .innerJoin(orders, eq(orderLines.orderId, orders.id))
    .innerJoin(
      productVariants,
      eq(orderLines.productVariantId, productVariants.id),
    )
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(
      and(
        eq(orders.memberId, memberId),
        eq(orders.organisationId, organisationId),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(400);

  // First row per product wins because the query is newest-first.
  const latest = new Map<string, string>();
  for (const row of rows) {
    if (row.size && !latest.has(row.productId)) latest.set(row.productId, row.size);
  }
  return latest;
}

export type ReorderLine = {
  variantId: string;
  qty: number;
  productName: string;
  slug: string;
  image: string | null;
  colourName: string | null;
  size: string | null;
  logoPlacement: string | null;
  logoMethod: "embroidery" | "print" | "transfer" | null;
  /** False when the variant left the assortment or is out of stock. */
  available: boolean;
};

/**
 * The employee's most recent order, shaped for one-tap reordering.
 *
 * Availability is resolved here rather than in the browser: a line whose variant
 * has since left the assortment must not be re-addable, and the client has no
 * way to know that.
 */
export async function getLastOrderForReorder(
  organisationId: string,
  memberId: string,
): Promise<{ orderNumber: string; createdAt: Date; lines: ReorderLine[] } | null> {
  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      and(
        eq(orders.memberId, memberId),
        eq(orders.organisationId, organisationId),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(1);

  if (!order) return null;

  const lines = await db
    .select({
      variantId: orderLines.productVariantId,
      qty: orderLines.quantity,
      productName: products.name,
      slug: products.slug,
      image: products.primaryImage,
      colourName: productVariants.colourName,
      size: productVariants.size,
      logoPlacement: orderLines.logoPlacement,
      logoMethod: orderLines.logoMethod,
      stockQty: productVariants.stockQty,
      variantActive: productVariants.isActive,
      productActive: products.isActive,
      price: orgPricing.priceDkk,
      enabled: orgAssortment.isEnabled,
    })
    .from(orderLines)
    .innerJoin(
      productVariants,
      eq(orderLines.productVariantId, productVariants.id),
    )
    .innerJoin(products, eq(productVariants.productId, products.id))
    .leftJoin(
      orgAssortment,
      and(
        eq(orgAssortment.productId, products.id),
        eq(orgAssortment.organisationId, organisationId),
      ),
    )
    .leftJoin(
      orgPricing,
      and(
        eq(orgPricing.productVariantId, productVariants.id),
        eq(orgPricing.organisationId, organisationId),
      ),
    )
    .where(eq(orderLines.orderId, order.id))
    .limit(20);

  return {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    lines: lines.map((l) => ({
      variantId: l.variantId,
      qty: l.qty,
      productName: l.productName,
      slug: l.slug,
      image: l.image,
      colourName: l.colourName,
      size: l.size,
      logoPlacement: l.logoPlacement,
      logoMethod: l.logoMethod,
      available:
        l.enabled === true &&
        l.variantActive &&
        l.productActive &&
        l.price !== null &&
        l.stockQty > 0,
    })),
  };
}

export type ReturnableItem = {
  id: string;
  orderNumber: string;
  label: string;
  orderedOn: Date;
};

/**
 * Lines this employee could send back.
 *
 * Only orders that have actually left: something still in the building is a
 * cancellation, not a return, and goes through the customer admin instead.
 * "Left" is the dispatch timestamp rather than a status, because dispatch does
 * not move an order (Q-C2 c) — `delivered` is still included for orders that
 * went out before the timestamp existed.
 */
export async function listReturnableItems(
  organisationId: string,
  memberId: string,
): Promise<ReturnableItem[]> {
  const rows = await db
    .select({
      id: orderLines.id,
      orderNumber: orders.orderNumber,
      createdAt: orders.createdAt,
      productName: products.name,
      colourName: productVariants.colourName,
      size: productVariants.size,
    })
    .from(orderLines)
    .innerJoin(orders, eq(orderLines.orderId, orders.id))
    .innerJoin(
      productVariants,
      eq(orderLines.productVariantId, productVariants.id),
    )
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(
      and(
        eq(orders.memberId, memberId),
        eq(orders.organisationId, organisationId),
        or(isNotNull(orders.dispatchedAt), eq(orders.status, "delivered")),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(30);

  return rows.map((r) => ({
    id: r.id,
    orderNumber: r.orderNumber,
    orderedOn: r.createdAt,
    label: [r.productName, r.colourName, r.size].filter(Boolean).join(" · "),
  }));
}
