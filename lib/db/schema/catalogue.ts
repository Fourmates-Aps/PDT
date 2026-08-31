import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/*
 * Authorisation lives in lib/db/sql/10-rls-policies.sql — see organisations.ts.
 *
 * NOTE ON TENANCY — worth raising with Rasmus.
 *
 * DEV_BRIEF_IMPLEMENTATION_PLAN.md §1.1 states every table except system lookups
 * must carry `organisation_id`. Its own SQL in §2.1 then defines `products` and
 * `product_variants` WITHOUT one, which is correct: this is shared supplier master
 * data (You, Mascot, Fristads…), identical for every tenant. Duplicating 12,402
 * variants per customer would be wrong.
 *
 * Tenancy is applied on top instead:
 *   org_assortment — which products a given organisation may see and order
 *   org_pricing    — what that organisation pays for a given variant
 */

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierId: text("supplier_id").notNull(),
    supplierSku: text("supplier_sku").notNull(),
    brand: text("brand").notNull(),
    name: text("name").notNull(),
    /** URL segment for /shop/[slug]. Stable even if the display name changes. */
    slug: text("slug").notNull(),
    nameEn: text("name_en"),
    category: text("category").notNull(),
    subcategory: text("subcategory"),
    gender: text("gender"),
    material: text("material"),
    co2Kg: numeric("co2_kg", { precision: 6, scale: 3 }),
    /**
     * Explicit, because absent CO2 data is not the same as zero. Fristads does not
     * publish it at all and only part of the You feed carries it — the UI must be
     * able to say "not available" rather than imply a footprint of nothing.
     */
    co2Available: boolean("co2_available").notNull().default(false),
    primaryImage: text("primary_image"),
    isActive: boolean("is_active").notNull().default(true),
    rawData: jsonb("raw_data"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("products_supplier_sku_key").on(t.supplierId, t.supplierSku),
    uniqueIndex("products_slug_key").on(t.slug),
    index("products_category_idx").on(t.category),
  ],
).enableRLS();

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /**
     * The supplier's own article number for this exact variant.
     *
     * The stable identity. EAN is absent on 179 variants in the You feed and
     * colour/size is not identity at all — a supplier renaming "Marine" to
     * "Navy" would otherwise read as one variant discontinued and another
     * created, taking the stock and the order history with it.
     *
     * Nullable because not every supplier publishes one and the seeded demo
     * catalogue has none. Matching falls back to EAN, then colour+size — see
     * variantAliases() in lib/import/diff.ts.
     */
    sku: text("sku"),
    ean: text("ean"),
    colourName: text("colour_name"),
    colourHex: text("colour_hex"),
    size: text("size"),
    fit: text("fit"),
    listPriceDkk: numeric("list_price_dkk", { precision: 10, scale: 2 }).notNull(),
    netPriceDkk: numeric("net_price_dkk", { precision: 10, scale: 2 }),
    stockQty: integer("stock_qty").notNull().default(0),
    /**
     * Whether `stock_qty` means anything for this variant.
     *
     * FALSE means the supplier publishes no quantities at all — You/F&H keep
     * theirs in a B2B portal and never put them in the export. For those
     * variants a stored 0 is an absence of information, not an absence of goods,
     * and treating it as "sold out" would make 11,091 orderable garments
     * unbuyable.
     *
     * PDT buys in per order anyway — D-3 makes "Ankommet på lager" a customer-
     * visible stage precisely because the goods are not on a shelf when the
     * order is placed. So an untracked variant is ordered, then bought in. What
     * changes is only WHERE the truth about stock lives: for a tracked variant
     * it is this column, and for an untracked one it is the supplier's portal.
     *
     * Set by the importer from the feed on every publish, so it is self-healing:
     * a supplier that starts publishing stock flips its variants to tracked
     * without anyone editing anything.
     */
    stockTracked: boolean("stock_tracked").notNull().default(true),
    /** Incoming stock windows from supplier feeds, e.g. {"4w":200,"8w":400}. */
    stockIncoming: jsonb("stock_incoming"),
    /** Feeds are batch, not realtime — the UI must show "updated at", never "live". */
    stockUpdatedAt: timestamp("stock_updated_at", { withTimezone: true }),
    imageUrls: text("image_urls").array(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // EAN is unique where present, but 179 variants in the You feed have none,
    // so this is a partial index rather than a NOT NULL unique column.
    uniqueIndex("product_variants_ean_key")
      .on(t.ean)
      .where(sql`${t.ean} is not null`),
    /*
     * Scoped to the product, not global: a SKU is the SUPPLIER's namespace, and
     * two suppliers may legitimately use the same string. Variants carry no
     * supplier_id — the product does — so the product is the tightest scope
     * available here, and it catches the case that actually matters: the same
     * SKU twice inside one style.
     */
    uniqueIndex("product_variants_product_sku_key")
      .on(t.productId, t.sku)
      .where(sql`${t.sku} is not null`),
    index("product_variants_product_idx").on(t.productId),
  ],
).enableRLS();
