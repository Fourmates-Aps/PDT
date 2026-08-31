import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  Connector,
  ConnectorOptions,
  Feed,
  FeedProduct,
  FeedVariant,
  SkippedRow,
} from "../types";

/**
 * You / F&H Group.
 *
 * WHAT "LIVE" MEANS HERE — READ THIS BEFORE ADDING A URL.
 *
 * F&H offers NO API for system-to-system integration (SuuplierIntegration.md
 * §"F&H Group A/S"). What exists is a complete PIM export in Excel/CSV, and
 * whether a pollable feed exists at all is still an open question with the
 * supplier (§You: "clarify whether an API/feed exists for continuous updates").
 *
 * So this connector reads a FILE — the export as delivered — and not a socket.
 * That is not a limitation of the implementation; it is the channel the supplier
 * offers. When they hand over a URL, only `locate()` below needs to change.
 *
 * NO STOCK, ON PURPOSE. The export carries no quantities: stock lives in F&H's
 * B2B shop UI, shown only as "under 50 pcs" (Supplier_data_capabilities.md).
 * Every variant therefore reports `stockQty: null` — "this feed has no opinion" —
 * and publish leaves whatever is stored untouched. Writing 0 would make the
 * whole catalogue unorderable the first time checkout checked availability;
 * inventing a number, as the demo seed does, would promise goods that may not
 * exist. Neither is acceptable outside a demo.
 */

/** Where the export lives when no file is given. */
const DEFAULT_FILE = join("prototype", "You_katalog_fuld.json");

/**
 * The export's own shape. Narrow on purpose: fields we do not read are not
 * declared, so a supplier adding columns cannot break parsing.
 */
type RawVariant = {
  sku?: string | null;
  color?: string | null;
  hex?: string | null;
  size?: string | null;
  ean?: string | null;
};

type RawProduct = {
  productNr?: string | null;
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  priceVejl?: number | null;
  priceForhandler?: number | null;
  priceNet?: number | null;
  co2?: number | null;
  image1?: string | null;
  image2?: string | null;
  variants?: RawVariant[];
};

type RawFeed = { supplier?: string; products?: RawProduct[] };

/**
 * The export mixes Norwegian into Danish category names — F&H sell across
 * Scandinavia from one PIM. Left alone, "Gensere" and "Treningstøy" appear
 * untranslated in a Danish shop and match nothing in lib/content/navigation.ts.
 */
const CATEGORY_DA: Record<string, string> = {
  Gensere: "Sweatshirts",
  Reiseeffekter: "Rejseeffekter",
  Treningstøy: "Træningstøj",
  Synlighetsartikler: "Synlighed",
  Handlenett: "Mulepose",
  Tennisskjorter: "Poloshirts",
  Accessories: "Tilbehør",
  Headwear: "Huer & caps",
};

/** Money as a decimal string. Never a float — see FeedVariant.listPriceDkk. */
function money(value: number | null | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value.toFixed(2);
}

function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function parseYouFeed(
  contents: string,
  source: string,
): Promise<Feed> {
  let raw: RawFeed;
  try {
    raw = JSON.parse(contents) as RawFeed;
  } catch (error) {
    throw new Error(
      `${source} is not valid JSON: ${error instanceof Error ? error.message : error}`,
    );
  }

  if (!Array.isArray(raw.products)) {
    throw new Error(`${source} has no "products" array — is this the You export?`);
  }

  const products: FeedProduct[] = [];
  const skipped: SkippedRow[] = [];

  /*
   * EAN is unique across the WHOLE table, not per product, and the export
   * repeats a handful. Deduplicating per product — as the demo seed does —
   * leaves collisions that only surface as a constraint violation halfway
   * through a publish, after some rows are already written.
   *
   * A repeat is dropped to null rather than dropping the variant: since the SKU
   * column exists, the variant is still fully identifiable without its EAN.
   */
  const seenEan = new Set<string>();

  for (const p of raw.products) {
    const supplierSku = text(p.productNr);
    const name = text(p.name);

    if (!supplierSku || !name) {
      skipped.push({
        row: JSON.stringify({ productNr: p.productNr, name: p.name }),
        reason: "mangler varenummer eller navn",
      });
      continue;
    }

    // "Katalog" is F&H's own printed catalogue, not a garment.
    const rawCategory = text(p.category);
    if (rawCategory === "Katalog") {
      skipped.push({ row: supplierSku, reason: "kategorien Katalog er ikke en vare" });
      continue;
    }

    if (!Array.isArray(p.variants) || p.variants.length === 0) {
      skipped.push({ row: supplierSku, reason: "ingen varianter" });
      continue;
    }

    const brand = text(p.brand) ?? "You";
    const category = rawCategory ? (CATEGORY_DA[rawCategory] ?? rawCategory) : "Diverse";

    /*
     * Prices are per PRODUCT in this export, not per variant, so every size of
     * a style carries the same figure. priceVejl is the recommended retail
     * price and priceNet is our cost; what a customer actually pays is set in
     * org_pricing and never comes from here.
     */
    const listPriceDkk = money(p.priceVejl) ?? money(p.priceForhandler);
    const netPriceDkk = money(p.priceNet);

    // Only 237 of the 700 products carry a figure. Absent means NOT DISCLOSED,
    // which is a different claim from a footprint of zero.
    const co2Kg = money(p.co2);

    const images = [text(p.image1), text(p.image2)].filter(
      (u): u is string => Boolean(u),
    );

    const variants: FeedVariant[] = [];
    for (const v of p.variants) {
      const sku = text(v.sku);
      const rawEan = text(v.ean);

      let ean: string | null = null;
      if (rawEan && !seenEan.has(rawEan)) {
        seenEan.add(rawEan);
        ean = rawEan;
      }

      if (!sku && !ean) {
        skipped.push({
          row: `${supplierSku} / ${v.color ?? "?"} / ${v.size ?? "?"}`,
          reason: "hverken SKU eller EAN — kan ikke identificeres",
        });
        continue;
      }

      variants.push({
        sku,
        ean,
        colourName: text(v.color),
        colourHex: text(v.hex),
        size: text(v.size),
        fit: null,
        listPriceDkk,
        netPriceDkk,
        // See the header: this feed publishes no stock, and null says so.
        stockQty: null,
        stockIncoming: null,
        imageUrls: images,
      });
    }

    if (variants.length === 0) {
      skipped.push({ row: supplierSku, reason: "ingen brugbare varianter" });
      continue;
    }

    products.push({
      supplierSku,
      brand,
      name,
      nameEn: null,
      category,
      subcategory: null,
      gender: null,
      material: null,
      primaryImage: images[0] ?? null,
      co2Kg,
      co2Available: co2Kg !== null,
      variants,
    });
  }

  return { supplierId: "FH_YOU", source, products, skipped };
}

export const fhYouConnector: Connector = {
  id: "FH_YOU",
  label: "You / F&H Group",

  async fetch(options: ConnectorOptions): Promise<Feed> {
    const path = options.file ?? process.env.FH_YOU_FEED_FILE ?? DEFAULT_FILE;

    let contents: string;
    try {
      contents = await readFile(path, "utf8");
    } catch (error) {
      throw new Error(
        `Could not read the You export at "${path}". F&H deliver it as a file ` +
          `(Excel/CSV → JSON); set FH_YOU_FEED_FILE or pass --file. ` +
          `(${error instanceof Error ? error.message : error})`,
      );
    }

    const feed = await parseYouFeed(contents, path);

    if (options.limit && options.limit > 0) {
      return { ...feed, products: feed.products.slice(0, options.limit) };
    }
    return feed;
  },
};
