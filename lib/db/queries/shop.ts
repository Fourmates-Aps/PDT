import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  orderLines,
  orders,
  orgAssortment,
  orgPricing,
  organisationMembers,
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
