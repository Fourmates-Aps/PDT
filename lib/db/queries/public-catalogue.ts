import "server-only";
import { and, asc, count, desc, eq, ilike, isNotNull, ne, or, sql } from "drizzle-orm";
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
export async function listPublicCategories(
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
export async function listPublicProducts(options?: {
  category?: string;
  query?: string;
  limit?: number;
}): Promise<PublicProduct[]> {
  const filters = [eq(products.isActive, true), NOT_A_FIXTURE];

  if (options?.category) {
    filters.push(eq(products.category, options.category));
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
};

/** One product, everything a visitor may see — and nothing else. */
export async function getPublicProduct(
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
export async function listPublicBrands(): Promise<PublicBrand[]> {
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
