import "server-only";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  orgAssortment,
  orgPricing,
  organisations,
  productVariants,
  products,
} from "@/lib/db/schema";
import { dgPct } from "@/lib/pricing";

/**
 * Queries behind Prissætning (the prototype's `katalog` view).
 *
 * Prices are held per VARIANT in org_pricing, because a 4XL can legitimately
 * cost more than an S. The screen works per PRODUCT, because nobody sets a
 * markup one size at a time — so these queries aggregate variants up to the
 * product and the write path fans back out. Where variants of one product carry
 * different prices, the range is surfaced rather than silently averaged away.
 */

export type PricingFilters = {
  brand?: string;
  category?: string;
  q?: string;
  /** Null means list prices ("vejledende"), not a customer's agreed price. */
  organisationId?: string | null;
  /** Restrict to the customer's enabled range. Requires organisationId. */
  onlyAssortment?: boolean;
};

export type PricingRow = {
  productId: string;
  name: string;
  brand: string;
  category: string;
  image: string | null;
  variantCount: number;
  /** Supplier cost, ex VAT. Null when the feed carries no net price. */
  costMin: number | null;
  costMax: number | null;
  /** What the customer pays today: org_pricing if set, otherwise list price. */
  priceMin: number | null;
  priceMax: number | null;
  /** True when org_pricing exists for at least one variant of this product. */
  hasAgreedPrice: boolean;
  /** Whether this product is in the selected customer's assortment. */
  inAssortment: boolean;
  dg: number | null;
};

const NUM = (v: string | number | null) =>
  v === null || v === undefined ? null : Number(v);

/**
 * One row per product, priced for a customer or at list.
 *
 * Cost falls back to the list price when the supplier feed carries no net
 * price: showing 100 % margin because a column is empty would be worse than
 * showing 0 %, and the empty-cost case is flagged in the UI either way.
 */
export async function listPricingRows(
  filters: PricingFilters,
  limit = 300,
): Promise<PricingRow[]> {
  const orgId = filters.organisationId ?? null;

  const rows = await db
    .select({
      productId: products.id,
      name: products.name,
      brand: products.brand,
      category: products.category,
      image: products.primaryImage,
      variantCount: sql<number>`count(${productVariants.id})::int`,
      costMin: sql<string | null>`min(coalesce(${productVariants.netPriceDkk}, ${productVariants.listPriceDkk}))`,
      costMax: sql<string | null>`max(coalesce(${productVariants.netPriceDkk}, ${productVariants.listPriceDkk}))`,
      // COALESCE per row, not per aggregate: a product with a price on some
      // variants and not others must show the real spread.
      priceMin: sql<string | null>`min(coalesce(${orgPricing.priceDkk}, ${productVariants.listPriceDkk}))`,
      priceMax: sql<string | null>`max(coalesce(${orgPricing.priceDkk}, ${productVariants.listPriceDkk}))`,
      agreed: sql<number>`count(${orgPricing.id})::int`,
      inAssortment: sql<boolean>`bool_or(coalesce(${orgAssortment.isEnabled}, false))`,
    })
    .from(products)
    .innerJoin(
      productVariants,
      and(
        eq(productVariants.productId, products.id),
        eq(productVariants.isActive, true),
      ),
    )
    .leftJoin(
      orgPricing,
      orgId
        ? and(
            eq(orgPricing.productVariantId, productVariants.id),
            eq(orgPricing.organisationId, orgId),
          )
        : sql`false`,
    )
    .leftJoin(
      orgAssortment,
      orgId
        ? and(
            eq(orgAssortment.productId, products.id),
            eq(orgAssortment.organisationId, orgId),
          )
        : sql`false`,
    )
    .where(
      and(
        eq(products.isActive, true),
        filters.onlyAssortment && orgId
          ? eq(orgAssortment.isEnabled, true)
          : undefined,
        filters.brand ? eq(products.brand, filters.brand) : undefined,
        filters.category ? eq(products.category, filters.category) : undefined,
        filters.q
          ? or(
              ilike(products.name, `%${filters.q}%`),
              ilike(products.supplierSku, `%${filters.q}%`),
            )
          : undefined,
      ),
    )
    .groupBy(products.id)
    .orderBy(asc(products.brand), asc(products.name))
    .limit(limit);

  return rows.map((r) => {
    const costMin = NUM(r.costMin);
    const costMax = NUM(r.costMax);
    const priceMin = NUM(r.priceMin);
    const priceMax = NUM(r.priceMax);
    return {
      productId: r.productId,
      name: r.name,
      brand: r.brand,
      category: r.category,
      image: r.image,
      variantCount: r.variantCount,
      costMin,
      costMax,
      priceMin,
      priceMax,
      hasAgreedPrice: r.agreed > 0,
      inAssortment: r.inAssortment === true,
      // Measured on the cheapest variant: that is the one a margin floor bites
      // on first.
      dg: costMin !== null && priceMin !== null ? dgPct(costMin, priceMin) : null,
    };
  });
}

export async function listCatalogueBrands(): Promise<
  { brand: string; count: number }[]
> {
  return db
    .select({
      brand: products.brand,
      count: sql<number>`count(*)::int`,
    })
    .from(products)
    .where(eq(products.isActive, true))
    .groupBy(products.brand)
    .orderBy(asc(products.brand));
}

export async function listCatalogueCategories(
  brand?: string,
): Promise<{ category: string; count: number }[]> {
  return db
    .select({
      category: products.category,
      count: sql<number>`count(*)::int`,
    })
    .from(products)
    .where(
      and(
        eq(products.isActive, true),
        brand ? eq(products.brand, brand) : undefined,
      ),
    )
    .groupBy(products.category)
    .orderBy(asc(products.category));
}

export type PricingCustomer = {
  id: string;
  name: string;
  slug: string;
  minimumDgPct: number;
  assortmentCount: number;
  pricedCount: number;
};

/**
 * Customers to price for, with how much of the catalogue they already carry.
 *
 * Three small queries rather than one with correlated subselects: the counts
 * come back as their own grouped result sets and are merged here, which is
 * easier to verify than a subquery whose correlation has to be read twice.
 */
export async function listPricingCustomers(): Promise<PricingCustomer[]> {
  const [orgs, priced, assorted] = await Promise.all([
    db
      .select({
        id: organisations.id,
        name: organisations.name,
        slug: organisations.slug,
        minimumDgPct: organisations.minimumDgPct,
      })
      .from(organisations)
      .where(eq(organisations.isActive, true))
      .orderBy(asc(organisations.name)),

    db
      .select({
        organisationId: orgPricing.organisationId,
        count: sql<number>`count(*)::int`,
      })
      .from(orgPricing)
      .groupBy(orgPricing.organisationId),

    db
      .select({
        organisationId: orgAssortment.organisationId,
        count: sql<number>`count(*)::int`,
      })
      .from(orgAssortment)
      .where(eq(orgAssortment.isEnabled, true))
      .groupBy(orgAssortment.organisationId),
  ]);

  const pricedBy = new Map(priced.map((r) => [r.organisationId, r.count]));
  const assortedBy = new Map(assorted.map((r) => [r.organisationId, r.count]));

  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    minimumDgPct: Number(o.minimumDgPct),
    pricedCount: pricedBy.get(o.id) ?? 0,
    assortmentCount: assortedBy.get(o.id) ?? 0,
  }));
}

export type PricingSummary = {
  products: number;
  variants: number;
  /** Median rather than mean: one 90 %-margin cap should not move the headline. */
  medianDg: number | null;
  belowMinimum: number;
  missingCost: number;
};

/** Headline numbers for the current filter, measured on the same rows shown. */
export function summarise(
  rows: PricingRow[],
  minimumDg: number,
): PricingSummary {
  const dgs = rows
    .map((r) => r.dg)
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);

  const median =
    dgs.length === 0
      ? null
      : dgs.length % 2
        ? dgs[(dgs.length - 1) / 2]
        : Math.round(((dgs[dgs.length / 2 - 1] + dgs[dgs.length / 2]) / 2) * 100) /
          100;

  return {
    products: rows.length,
    variants: rows.reduce((s, r) => s + r.variantCount, 0),
    medianDg: median,
    belowMinimum: rows.filter((r) => r.dg !== null && r.dg < minimumDg).length,
    missingCost: rows.filter((r) => r.costMin === null).length,
  };
}
