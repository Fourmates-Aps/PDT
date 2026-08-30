/**
 * The shape every supplier connector must produce.
 *
 * SuuplierIntegration.md lists eight suppliers speaking CSV, XML, GraphQL, EDI,
 * SFTP and a portal. The pipeline knows none of that: a connector's whole job is
 * to turn its supplier's dialect into this, and everything after it — diffing,
 * staging, review, publishing — is written once and shared.
 *
 * Deliberately free of database types. A connector parses a file; it must not be
 * able to touch the catalogue.
 */

export type FeedVariant = {
  /** The supplier's own SKU. Unique within the supplier. */
  sku: string;
  ean: string | null;
  colourName: string | null;
  colourHex: string | null;
  size: string | null;
  fit: string | null;
  /** Decimal strings, not numbers — money never goes through a float. */
  listPriceDkk: string | null;
  netPriceDkk: string | null;
  stockQty: number;
  /**
   * Incoming stock by horizon, e.g. `{ "4w": 200, "8w": 400 }`.
   *
   * TEE JAYS publishes 4/8/12/16-week forecasts and Fristads publishes a plain
   * quantity, so the shape is a map rather than fixed columns.
   */
  stockIncoming: Record<string, number> | null;
  imageUrls: string[];
};

export type FeedProduct = {
  /** The supplier's parent product number. Our natural key with supplierId. */
  supplierSku: string;
  brand: string;
  name: string;
  nameEn: string | null;
  category: string;
  subcategory: string | null;
  gender: string | null;
  material: string | null;
  primaryImage: string | null;
  /**
   * Kilograms of CO₂e, and whether the supplier publishes it at all.
   *
   * The two are separate on purpose. Fristads explicitly does NOT share CO₂ data
   * (SuuplierIntegration.md cites data-theft risk), and "not disclosed" is not
   * the same claim as "zero". A connector that cannot get the figure sets
   * `co2Available: false` and the shop says so.
   */
  co2Kg: string | null;
  co2Available: boolean;
  variants: FeedVariant[];
};

/** A row the connector could not use, kept so the run can explain itself. */
export type SkippedRow = { row: string; reason: string };

export type Feed = {
  supplierId: string;
  /** A path or filename — never a URL carrying credentials. */
  source: string;
  products: FeedProduct[];
  skipped: SkippedRow[];
};

export type ConnectorOptions = {
  /** Parse this local file instead of connecting. Used by tests and dry runs. */
  file?: string;
  /** Cap the number of products, for a quick smoke run against a real feed. */
  limit?: number;
};

export type Connector = {
  id: string;
  label: string;
  fetch(options: ConnectorOptions): Promise<Feed>;
};

/**
 * A URL-safe, stable slug.
 *
 * The supplier SKU is on the end because names collide — Fristads sells more
 * than one "Jakke" — and `products.slug` is uniquely indexed. Deriving it from
 * the SKU rather than a counter means re-importing the same product produces the
 * same slug, so links do not rot between imports.
 */
export function productSlug(
  brand: string,
  name: string,
  supplierSku: string,
): string {
  const base = `${brand} ${name} ${supplierSku}`
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, 120);
}
