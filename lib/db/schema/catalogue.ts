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
    ean: text("ean"),
    colourName: text("colour_name"),
    colourHex: text("colour_hex"),
    size: text("size"),
    fit: text("fit"),
    listPriceDkk: numeric("list_price_dkk", { precision: 10, scale: 2 }).notNull(),
    netPriceDkk: numeric("net_price_dkk", { precision: 10, scale: 2 }),
    stockQty: integer("stock_qty").notNull().default(0),
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
    index("product_variants_product_idx").on(t.productId),
  ],
).enableRLS();
