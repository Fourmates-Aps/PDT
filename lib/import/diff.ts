import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { productVariants, products } from "@/lib/db/schema";
import { productSlug, type FeedProduct, type FeedVariant } from "./types";

/**
 * What an import would do to the catalogue, worked out before anything is
 * written.
 *
 * The whole point of staging: a reviewer sees "12 new, 30 changed, 4
 * discontinued" and the products behind each number, and only then does anything
 * touch the live shop.
 */

export type ChangeType = "created" | "updated" | "discontinued" | "unchanged";

export type Change = {
  type: ChangeType;
  supplierSku: string;
  productId: string | null;
  before: ComparableProduct | null;
  after: FeedProduct | null;
  summary: string;
};

export type Diff = {
  changes: Change[];
  counts: Record<ChangeType, number>;
};

/**
 * The catalogue as the importer sees it — only the fields a feed owns.
 *
 * Comparing whole database rows would flag every product on every run, because
 * `updated_at` always differs. This is the subset a supplier is actually the
 * source of truth for.
 */
export type ComparableProduct = {
  supplierSku: string;
  brand: string;
  name: string;
  nameEn: string | null;
  category: string;
  subcategory: string | null;
  gender: string | null;
  material: string | null;
  primaryImage: string | null;
  co2Kg: string | null;
  co2Available: boolean;
  isActive: boolean;
  variants: ComparableVariant[];
};

/**
 * How a variant is recognised across imports.
 *
 * `product_variants` has no supplier-SKU column, so EAN is the natural key —
 * both Fristads and TEE JAYS publish one per size. When a supplier omits it,
 * colour and size together identify the variant well enough, and the fallback is
 * deterministic so the same variant matches itself on the next run.
 */
export function variantKey(v: {
  ean: string | null;
  colourName: string | null;
  size: string | null;
}): string {
  return v.ean?.trim() || `${v.colourName ?? ""}|${v.size ?? ""}`;
}

export type ComparableVariant = {
  sku: string;
  ean: string | null;
  colourName: string | null;
  colourHex: string | null;
  size: string | null;
  fit: string | null;
  listPriceDkk: string | null;
  netPriceDkk: string | null;
  stockQty: number;
  imageUrls: string[];
};

/** Everything we currently hold for one supplier, keyed by their SKU. */
export async function loadCurrent(
  supplierId: string,
): Promise<Map<string, ComparableProduct & { id: string }>> {
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.supplierId, supplierId));

  const byId = new Map<string, ComparableProduct & { id: string }>();
  for (const row of rows) {
    byId.set(row.supplierSku, {
      id: row.id,
      supplierSku: row.supplierSku,
      brand: row.brand,
      name: row.name,
      nameEn: row.nameEn,
      category: row.category,
      subcategory: row.subcategory,
      gender: row.gender,
      material: row.material,
      primaryImage: row.primaryImage,
      co2Kg: row.co2Kg,
      co2Available: row.co2Available,
      isActive: row.isActive,
      variants: [],
    });
  }

  if (rows.length === 0) return byId;

  // Scoped to the products just read. Selecting every active variant in the
  // database and filtering in JS would load the whole catalogue to diff one
  // supplier.
  const variants = await db
    .select()
    .from(productVariants)
    .where(
      and(
        eq(productVariants.isActive, true),
        inArray(
          productVariants.productId,
          rows.map((r) => r.id),
        ),
      ),
    );

  const productById = new Map(rows.map((r) => [r.id, r.supplierSku]));
  for (const v of variants) {
    const sku = productById.get(v.productId);
    if (!sku) continue;
    byId.get(sku)?.variants.push({
      sku: variantKey(v),
      ean: v.ean,
      colourName: v.colourName,
      colourHex: v.colourHex,
      size: v.size,
      fit: v.fit,
      listPriceDkk: v.listPriceDkk,
      netPriceDkk: v.netPriceDkk,
      stockQty: v.stockQty,
      imageUrls: v.imageUrls ?? [],
    });
  }

  return byId;
}

const money = (value: string | null): string | null =>
  value === null ? null : Number(value).toFixed(2);

/** True when a feed product differs from what we hold in any field we import. */
function describeChanges(
  before: ComparableProduct,
  after: FeedProduct,
): string[] {
  const notes: string[] = [];

  if (before.name !== after.name) {
    notes.push(`navn "${before.name}" → "${after.name}"`);
  }
  if (before.category !== after.category) {
    notes.push(`kategori ${before.category} → ${after.category}`);
  }
  if (before.material !== after.material) notes.push("materiale ændret");
  if (before.primaryImage !== after.primaryImage) notes.push("billede ændret");
  if (!before.isActive) notes.push("genaktiveret");

  const beforeSkus = new Set(before.variants.map(variantKey));
  const afterSkus = new Set(after.variants.map(variantKey));
  const added = [...afterSkus].filter((s) => !beforeSkus.has(s)).length;
  const removed = [...beforeSkus].filter((s) => !afterSkus.has(s)).length;
  if (added) notes.push(`${added} nye varianter`);
  if (removed) notes.push(`${removed} varianter udgået`);

  // Price is called out by name because it is the change a human most wants to
  // see before it reaches a customer's shop.
  const beforePrices = new Map(
    before.variants.map((v) => [variantKey(v), money(v.listPriceDkk)]),
  );
  const moved = after.variants.filter((v) => {
    const was = beforePrices.get(variantKey(v));
    return was !== undefined && was !== money(v.listPriceDkk);
  });
  if (moved.length > 0) {
    const example = moved[0];
    const was = beforePrices.get(variantKey(example));
    notes.push(
      `pris ${was} → ${money(example.listPriceDkk)}${
        moved.length > 1 ? ` (+${moved.length - 1} flere)` : ""
      }`,
    );
  }

  const stockMoved = after.variants.some((v) => {
    const key = variantKey(v);
    const match = before.variants.find((b) => variantKey(b) === key);
    return match !== undefined && match.stockQty !== v.stockQty;
  });
  if (stockMoved && notes.length === 0) notes.push("lagerantal opdateret");

  return notes;
}

/**
 * Compare a parsed feed against what we hold for that supplier.
 *
 * Products absent from the feed are `discontinued`, never deleted: order lines
 * reference variants, and deleting a product a customer bought would take its
 * order history with it.
 */
export function diffFeed(
  feedProducts: FeedProduct[],
  current: Map<string, ComparableProduct & { id: string }>,
): Diff {
  const changes: Change[] = [];
  const seen = new Set<string>();

  for (const product of feedProducts) {
    seen.add(product.supplierSku);
    const existing = current.get(product.supplierSku);

    if (!existing) {
      changes.push({
        type: "created",
        supplierSku: product.supplierSku,
        productId: null,
        before: null,
        after: product,
        summary: `Ny vare · ${product.brand} ${product.name} · ${product.variants.length} varianter`,
      });
      continue;
    }

    const notes = describeChanges(existing, product);
    changes.push({
      type: notes.length > 0 ? "updated" : "unchanged",
      supplierSku: product.supplierSku,
      productId: existing.id,
      before: existing,
      after: product,
      summary: notes.length > 0 ? notes.join(" · ") : "Uændret",
    });
  }

  for (const [sku, existing] of current) {
    if (seen.has(sku) || !existing.isActive) continue;
    changes.push({
      type: "discontinued",
      supplierSku: sku,
      productId: existing.id,
      before: existing,
      after: null,
      summary: `Udgået hos leverandøren · ${existing.brand} ${existing.name}`,
    });
  }

  const counts: Record<ChangeType, number> = {
    created: 0,
    updated: 0,
    discontinued: 0,
    unchanged: 0,
  };
  for (const change of changes) counts[change.type] += 1;

  return { changes, counts };
}

/** Re-exported so connectors and the publisher agree on slug generation. */
export { productSlug };
export type { FeedProduct, FeedVariant };
