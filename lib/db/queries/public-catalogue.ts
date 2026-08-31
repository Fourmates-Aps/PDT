import "server-only";
import { cacheKey as rawCacheKey, cached, invalidateTag } from "@/lib/cache";
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { productVariants, products } from "@/lib/db/schema";

/**
 * The catalogue as an unauthenticated visitor sees it.
 *
 * SEPARATE FROM lib/db/queries/shop.ts ON PURPOSE — and the separation is the
 * security boundary, not a tidiness preference.
 *
 * `db` connects as the database owner and therefore bypasses Row-Level Security
 * (see lib/db/index.ts), so nothing below the application layer will stop a
 * public page selecting `list_price_dkk`. **No query in this file may select a
 * price column.** Two independent reasons:
 *
 *  1. The running business does not publish prices. profildesigntrading.dk shows
 *     the full catalogue with the Pris and Antal columns empty and the line
 *     "Du skal være logget ind for at kunne lave bestillinger" — spec §0b.1.
 *     The catalogue is marketing; the price is the relationship.
 *  2. BR-39a: PF Concept's prices are contractually confidential. Putting a
 *     supplier-derived price on an unauthenticated page is disclosure to a third
 *     party, whatever the UI calls it.
 *
 * Stock is left out for the same reason — BR-39a covers stock as well, and a
 * public stock figure is a promise we cannot keep from a batch feed.
 */

/**
 * Catalogue reads are cached in Upstash Redis.
 *
 * The layout asks for every category on EVERY public page render, so without a
 * cache the front page, each product page and each catalogue page all pay for
 * the same query on every hit. The data behind it changes when a supplier feed
 * imports — overnight batches — not per request.
 *
 * Redis rather than Next's `unstable_cache`, which this replaces: that cache is
 * per instance and starts cold after every deploy, so N instances each pay for
 * the same query N times. Redis is one copy they all share. See lib/cache.ts.
 *
 * An hour is a ceiling, not the expected staleness: a feed import should call
 * revalidatePublicCatalogue() and publish immediately.
 */
export const CATALOGUE_TAG = "catalogue";

/**
 * Bump when the SHAPE of anything cached here changes.
 *
 * Cached entries outlive a deploy. When `variants` was added to
 * PublicProductDetail the live cache still held payloads without it, and the
 * product page threw "variants is not iterable" for every already-cached slug —
 * a 500 on real traffic caused by a field being ADDED. Versioning the key means
 * a new shape simply misses the old entries instead of reading them.
 */
const SHAPE = "v3";

const cacheKey = (name: string, args: unknown) =>
  rawCacheKey(`${SHAPE}:${name}`, args);
const CATALOGUE = { tag: CATALOGUE_TAG, ttl: 3600 } as const;

/** Retire every cached catalogue read. Call after a feed import publishes. */
export async function revalidatePublicCatalogue(): Promise<void> {
  await invalidateTag(CATALOGUE_TAG);
}

export type PublicProduct = {
  id: string;
  slug: string;
  brand: string;
  name: string;
  category: string;
  /** Shown as "Varenr." — the live site's only per-product number. */
  supplierSku: string;
  image: string | null;
};

export type PublicCategory = {
  /** The value stored on the product; also the URL segment, encoded. */
  name: string;
  products: number;
  /** Borrowed from the category's first product — no stock photography exists. */
  image: string | null;
};

/**
 * Seed fixtures must never reach a public page.
 *
 * scripts/seed-demo.mjs inserts a product under supplier "DEMO", brand "Demo".
 * It was showing up on the public Brands page as a brand PDT sells, next to You
 * and Westford Mill. Excluding it here rather than in each page means a future
 * public query cannot forget to.
 */
const NOT_A_FIXTURE = ne(products.supplierId, "DEMO");

const PUBLIC_COLUMNS = {
  id: products.id,
  slug: products.slug,
  brand: products.brand,
  name: products.name,
  category: products.category,
  supplierSku: products.supplierSku,
  image: products.primaryImage,
} as const;

/**
 * The categories that actually have products, largest first.
 *
 * Driven from the data rather than from a fixed list.
 *
 * ⚠ UPDATE 2026-08-30: the live site's navigation DOES publish a real tree —
 * Profiltøj, Arbejdstøj, Fodtøj, Firmagaver, Reklame artikler and Shop EL
 * Teknik, each with its own subcategories (Profiltøj → Skjorter · Jakker ·
 * T-shirt & Polo · Bukser · Strik · Fleece · Sweatshirt · Blazer · Veste ·
 * Sportstøj · Tilbehør, and so on). Earlier notes in this repo said no such
 * grouping was recorded anywhere; that was wrong, and it is recorded here so
 * nobody re-derives the same mistake.
 *
 * It is still not applied, because the mapping from those groups onto
 * `products.category` ("Poloshirts", "Huer & caps", "Synlighed"…) is a data
 * decision: several of our categories could sit under either Profiltøj or
 * Arbejdstøj, and guessing would file products under a heading nobody chose.
 * The feed pipeline (Backlog.md P1) is where that mapping belongs.
 */
async function listPublicCategoriesUncached(
  limit = 12,
): Promise<PublicCategory[]> {
  const rows = await db
    .select({
      name: products.category,
      products: count(products.id),
      // An arbitrary-but-stable image per category: the first one that exists.
      image: sql<string | null>`min(${products.primaryImage})`,
    })
    .from(products)
    .where(and(eq(products.isActive, true), NOT_A_FIXTURE))
    .groupBy(products.category)
    .orderBy(desc(count(products.id)), asc(products.category))
    .limit(limit);

  return rows;
}

/** Newest products, for the front page grid. */
async function listPublicProductsUncached(options?: {
  category?: string;
  /** Several categories at once — how a nav group is filtered. */
  categories?: string[];
  query?: string;
  limit?: number;
}): Promise<PublicProduct[]> {
  const filters = [eq(products.isActive, true), NOT_A_FIXTURE];

  if (options?.category) {
    filters.push(eq(products.category, options.category));
  }

  if (options?.categories) {
    // An empty set means the group carries nothing, which must return nothing —
    // not everything, which is what an omitted filter would do.
    filters.push(
      options.categories.length > 0
        ? inArray(products.category, options.categories)
        : sql`false`,
    );
  }

  // Deliberately naive: a LIKE across the four fields a visitor actually types.
  // Real search — typos, synonyms, "no results" suggestions — is P1 in
  // Backlog.md, not this pass.
  //
  // Category is in there because product names are model names ("Lyon", "Swan"),
  // so a search for "polo" matches nothing by name while a whole Poloshirts
  // category sits one click away. Leaving it out makes the search look broken on
  // the most obvious query anyone will try.
  const q = options?.query?.trim();
  if (q) {
    const pattern = `%${q}%`;
    filters.push(
      or(
        ilike(products.name, pattern),
        ilike(products.brand, pattern),
        ilike(products.category, pattern),
        ilike(products.supplierSku, pattern),
      )!,
    );
  }

  return db
    .select(PUBLIC_COLUMNS)
    .from(products)
    .where(and(...filters))
    .orderBy(desc(products.createdAt), asc(products.name))
    .limit(options?.limit ?? 12);
}

/**
 * Sizes come back in feed order, which is arbitrary — the You feed returns
 * S, XXL, M, L, XL, 3XL for one polo. A size list that is not in size order
 * reads as a bug, so they are ranked here rather than in the page.
 *
 * Both spellings of the big sizes appear across suppliers (XXL and 2XL), and
 * numeric sizes exist for trousers and footwear. Anything unrecognised keeps its
 * feed position at the end instead of being dropped — an odd size is still a
 * size somebody can order.
 */
const SIZE_ORDER = [
  "XXS", "XS", "S", "M", "L", "XL",
  "XXL", "2XL", "XXXL", "3XL", "4XL", "5XL",
];

function sizeRank(size: string): number {
  const index = SIZE_ORDER.indexOf(size.trim().toUpperCase());
  if (index !== -1) return index;

  const numeric = Number(size.replace(/[^\d]/g, ""));
  return Number.isFinite(numeric) && numeric > 0
    ? SIZE_ORDER.length + numeric
    : Number.MAX_SAFE_INTEGER;
}

export type PublicProductDetail = PublicProduct & {
  nameEn: string | null;
  material: string | null;
  gender: string | null;
  subcategory: string | null;
  co2Kg: string | null;
  co2Available: boolean;
  /** Distinct colours, in feed order. */
  colours: { name: string; hex: string | null }[];
  /** Distinct sizes. */
  sizes: string[];
  images: string[];
  /**
   * Which colour/size pairs actually exist, so the page can grey out the ones
   * that do not. A flat list of colours and a flat list of sizes implies every
   * combination is available, and for a 38-colour, 12-size style that is 456
   * promises of which only 292 are real.
   *
   * Carries the supplier's item number and NOTHING about money. The reference
   * site publishes item numbers on its logged-out product pages; price and
   * stock stay behind the login (BR-39a), and no such column is selected here.
   */
  variants: {
    colour: string | null;
    size: string | null;
    sku: string | null;
    /**
     * This variant's own photo, when the supplier publishes one.
     *
     * You/F&H do not: their export has no image field on a variant at all, so
     * all 699 products carry the same two product shots on every colour. Fristads
     * DO — their CSV has an image column per row. So this is null far more often
     * than not, and the gallery must treat a colour-specific picture as a bonus
     * rather than something it can rely on.
     */
    image: string | null;
  }[];
};

/** One product, everything a visitor may see — and nothing else. */
async function getPublicProductUncached(
  slug: string,
): Promise<PublicProductDetail | null> {
  const [product] = await db
    .select({
      ...PUBLIC_COLUMNS,
      nameEn: products.nameEn,
      material: products.material,
      gender: products.gender,
      subcategory: products.subcategory,
      co2Kg: products.co2Kg,
      co2Available: products.co2Available,
    })
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.isActive, true), NOT_A_FIXTURE))
    .limit(1);

  if (!product) return null;

  const variants = await db
    .select({
      colourName: productVariants.colourName,
      colourHex: productVariants.colourHex,
      size: productVariants.size,
      sku: productVariants.sku,
      imageUrls: productVariants.imageUrls,
    })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.productId, product.id),
        eq(productVariants.isActive, true),
      ),
    );

  const colours = new Map<string, string | null>();
  const sizes: string[] = [];
  const images = new Set<string>();

  if (product.image) images.add(product.image);

  for (const v of variants) {
    if (v.colourName && !colours.has(v.colourName)) {
      colours.set(v.colourName, v.colourHex);
    }
    if (v.size && !sizes.includes(v.size)) sizes.push(v.size);
    for (const url of v.imageUrls ?? []) images.add(url);
  }

  return {
    ...product,
    colours: [...colours].map(([name, hex]) => ({ name, hex })),
    sizes: sizes.sort((a, b) => sizeRank(a) - sizeRank(b)),
    images: [...images],
    variants: variants.map((v) => ({
      colour: v.colourName,
      size: v.size,
      sku: v.sku,
      image: v.imageUrls?.[0] ?? null,
    })),
  };
}

export type PublicBrand = { name: string; products: number };

/**
 * The brands actually represented in the range.
 *
 * The live site's Brands page is a wall of supplier logos. Those are third-party
 * trademarks, and whether PDT may reproduce each one on a NEW domain is a
 * question for PDT and each supplier — not something to assume by copying the
 * image files across. So this reads the brands out of the catalogue instead:
 * true, current, and it links somewhere useful.
 */
async function listPublicBrandsUncached(): Promise<PublicBrand[]> {
  return db
    .select({ name: products.brand, products: count(products.id) })
    .from(products)
    .where(and(eq(products.isActive, true), NOT_A_FIXTURE))
    .groupBy(products.brand)
    .orderBy(desc(count(products.id)), asc(products.brand));
}

/** Slugs for generateStaticParams / the sitemap. */
export async function listPublicProductSlugs(limit = 1000): Promise<string[]> {
  const rows = await db
    .select({ slug: products.slug })
    .from(products)
    .where(and(eq(products.isActive, true), isNotNull(products.slug), NOT_A_FIXTURE))
    .limit(limit);
  return rows.map((r) => r.slug);
}

/* ------------------------------------------------------------------ */
/* Cached entry points — the names every page imports                  */
/* ------------------------------------------------------------------ */

export function listPublicCategories(limit = 12): Promise<PublicCategory[]> {
  return cached(
    cacheKey("categories", limit),
    () => listPublicCategoriesUncached(limit),
    CATALOGUE,
  );
}

export function listPublicBrands(): Promise<PublicBrand[]> {
  return cached(cacheKey("brands", null), listPublicBrandsUncached, CATALOGUE);
}

export function getPublicProduct(
  slug: string,
): Promise<PublicProductDetail | null> {
  return cached(
    cacheKey("product", slug),
    () => getPublicProductUncached(slug),
    CATALOGUE,
  );
}

export function listPublicProducts(
  options?: Parameters<typeof listPublicProductsUncached>[0],
): Promise<PublicProduct[]> {
  /*
   * Free-text searches are NOT cached.
   *
   * The key includes the arguments, so caching these mints an entry for every
   * string anyone ever types — an unbounded keyspace that a crawler fills for
   * free, in a Redis shared with the rate limiter. Category and group listings
   * are a closed set and cache cleanly; `?q=` is not.
   */
  if (options?.query?.trim()) return listPublicProductsUncached(options);

  /*
   * The key is built from named fields rather than the options object, because
   * JSON.stringify follows property order: { category, limit } and
   * { limit, category } describe the same query and must not become two entries.
   */
  return cached(
    cacheKey("products", {
      category: options?.category ?? null,
      categories: options?.categories ? [...options.categories].sort() : null,
      limit: options?.limit ?? null,
    }),
    () => listPublicProductsUncached(options),
    CATALOGUE,
  );
}
