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

/** The three things that can identify a variant, best first. */
export type VariantIdentity = {
  sku?: string | null;
  ean: string | null;
  colourName: string | null;
  size: string | null;
};

/**
 * How a variant is recognised across imports.
 *
 * PRECEDENCE: supplier SKU, then EAN, then colour+size. Each is weaker than the
 * one before it. A SKU is the supplier's own permanent handle. An EAN is stable
 * but absent on 179 variants in the You feed. Colour+size is not identity at
 * all — it is a last resort, and a supplier renaming "Marine" to "Navy" breaks
 * it, which is exactly the failure the SKU column was added to end.
 *
 * Keys are PREFIXED because the namespaces overlap: a supplier whose SKU is the
 * digits of someone else's EAN would otherwise collide silently.
 */
export function variantKey(v: VariantIdentity): string {
  return variantAliases(v)[0];
}

/**
 * Every key a variant may be recognised by, strongest first.
 *
 * Matching on ALL of them is what makes adding the SKU column safe. Rows written
 * before this column existed have `sku = null` and are known only by their EAN;
 * the feed now offers a SKU as well. Matching on the primary key alone would
 * find nothing, and the next import would report the entire catalogue as
 * discontinued and re-create it — losing the stock, the images and the order
 * history hanging off those variant ids.
 *
 * With aliases, the old row matches on `ean:` and the update writes its SKU, so
 * the run after that matches on `sku:` and never needs the fallback again.
 */
export function variantAliases(v: VariantIdentity): string[] {
  const keys: string[] = [];
  const sku = v.sku?.trim();
  const ean = v.ean?.trim();

  if (sku) keys.push(`sku:${sku}`);
  if (ean) keys.push(`ean:${ean}`);
  keys.push(`cs:${v.colourName ?? ""}|${v.size ?? ""}`);

  return keys;
}

/** The existing variant a feed variant refers to, or undefined. */
export function matchVariant<T extends VariantIdentity>(
  feed: VariantIdentity,
  existingByAlias: Map<string, T>,
): T | undefined {
  for (const alias of variantAliases(feed)) {
    const found = existingByAlias.get(alias);
    if (found) return found;
  }
  return undefined;
}

/**
 * Index existing variants by every alias they answer to.
 *
 * A weaker alias never overwrites a stronger one's entry, so a colour+size
 * collision between two variants cannot steal a match from the variant that
 * owns the SKU.
 */
export function indexByAlias<T extends VariantIdentity>(variants: T[]): Map<string, T> {
  const byAlias = new Map<string, T>();
  for (const v of variants) {
    for (const alias of variantAliases(v)) {
      if (!byAlias.has(alias)) byAlias.set(alias, v);
    }
  }
  return byAlias;
}

export type ComparableVariant = {
  sku: string | null;
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
      sku: v.sku,
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

  /*
   * Compared through aliases, not a single key. A stored variant may be known
   * only by its EAN while the feed now also carries a SKU; matching on one key
   * would call the same variant both "new" and "discontinued" in the same run.
   */
  const beforeByAlias = indexByAlias(before.variants);
  const afterByAlias = indexByAlias(after.variants);

  const added = after.variants.filter(
    (v) => !matchVariant(v, beforeByAlias),
  ).length;
  const removed = before.variants.filter(
    (v) => !matchVariant(v, afterByAlias),
  ).length;
  if (added) notes.push(`${added} nye varianter`);
  if (removed) notes.push(`${removed} varianter udgået`);

  // Price is called out by name because it is the change a human most wants to
  // see before it reaches a customer's shop.
  const moved = after.variants.filter((v) => {
    const was = matchVariant(v, beforeByAlias);
    return was !== undefined && money(was.listPriceDkk) !== money(v.listPriceDkk);
  });
  if (moved.length > 0) {
    const example = moved[0];
    const was = matchVariant(example, beforeByAlias);
    notes.push(
      `pris ${money(was?.listPriceDkk ?? null)} → ${money(example.listPriceDkk)}${
        moved.length > 1 ? ` (+${moved.length - 1} flere)` : ""
      }`,
    );
  }

  /*
   * A variant gaining a SKU it did not have is a real change and must be
   * reported — otherwise the product is "unchanged", no change row is written,
   * publish never touches it, and the SKU is never backfilled. Rows loaded
   * before the column existed would keep matching on EAN forever and never
   * acquire the stronger identity.
   */
  const skuAdded = after.variants.filter((v) => {
    const match = matchVariant(v, beforeByAlias);
    return match !== undefined && !match.sku && Boolean(v.sku);
  }).length;
  if (skuAdded) notes.push(`${skuAdded} varianter fik SKU`);

  const stockMoved = after.variants.some((v) => {
    // A feed with no stock figure has not changed the stock. Comparing null
    // against a stored number would report "lagerantal opdateret" on every
    // single run of a stockless feed like You/F&H.
    if (v.stockQty === null) return false;
    const match = matchVariant(v, beforeByAlias);
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
