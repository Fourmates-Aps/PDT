import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { productVariants, products } from "@/lib/db/schema";
import { revalidatePublicCatalogue } from "@/lib/db/queries/public-catalogue";
import { indexByAlias, matchVariant, type Change } from "./diff";
import { productSlug, type FeedProduct } from "./types";

/**
 * Apply an approved diff.
 *
 * Everything happens in ONE transaction. A half-applied catalogue — new products
 * visible, their prices not yet written — is worse than a failed import, because
 * nothing tells you it happened.
 *
 * NOTHING IS EVER DELETED. A product that vanishes from a feed is deactivated,
 * because `order_lines` reference `product_variants`: deleting a product a
 * customer bought would take their order history with it. `is_active = false`
 * removes it from the shop and leaves the history intact.
 */

export type PublishResult = {
  created: number;
  updated: number;
  discontinued: number;
};

function variantValues(
  productId: string,
  v: FeedProduct["variants"][number],
) {
  return {
    productId,
    sku: v.sku,
    ean: v.ean,
    colourName: v.colourName,
    colourHex: v.colourHex,
    size: v.size,
    fit: v.fit,
    listPriceDkk: v.listPriceDkk ?? "0",
    netPriceDkk: v.netPriceDkk,
    stockIncoming: v.stockIncoming,
    imageUrls: v.imageUrls,
    isActive: true,
    /*
     * Stock is spread separately because a feed may have NO OPINION on it.
     * You/F&H publish no stock at all, and writing 0 for them would mark the
     * catalogue unorderable — while stamping stockUpdatedAt would claim the
     * figure had just been confirmed. Both are lies the shop would repeat to a
     * customer.
     */
    /*
     * The feed decides whether stock means anything here. Set on every publish
     * rather than only on insert, so a supplier who starts (or stops)
     * publishing quantities flips their variants without manual intervention.
     */
    stockTracked: v.stockQty !== null,
    ...(v.stockQty === null
      ? {}
      : { stockQty: v.stockQty, stockUpdatedAt: new Date() }),
  };
}

export async function publishChanges(
  supplierId: string,
  changes: Change[],
): Promise<PublishResult> {
  const result: PublishResult = { created: 0, updated: 0, discontinued: 0 };

  await db.transaction(async (tx) => {
    /** Products resolved in pass one, whose variants pass two writes. */
    const touched: { productId: string; feed: FeedProduct }[] = [];

    for (const change of changes) {
      if (change.type === "unchanged") continue;

      if (change.type === "discontinued" && change.productId) {
        await tx
          .update(products)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(products.id, change.productId));
        await tx
          .update(productVariants)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(productVariants.productId, change.productId));
        result.discontinued += 1;
        continue;
      }

      const feed = change.after;
      if (!feed) continue;

      const productFields = {
        supplierId,
        supplierSku: feed.supplierSku,
        brand: feed.brand,
        name: feed.name,
        nameEn: feed.nameEn,
        category: feed.category,
        subcategory: feed.subcategory,
        gender: feed.gender,
        material: feed.material,
        primaryImage: feed.primaryImage,
        co2Kg: feed.co2Kg,
        co2Available: feed.co2Available,
        isActive: true,
        updatedAt: new Date(),
      };

      let productId = change.productId;

      if (change.type === "created") {
        const [row] = await tx
          .insert(products)
          .values({
            ...productFields,
            slug: productSlug(feed.brand, feed.name, feed.supplierSku),
          })
          // The natural key is (supplier_id, supplier_sku). If a concurrent run
          // inserted it first, take the existing row rather than failing the
          // whole transaction over a race.
          .onConflictDoNothing()
          .returning({ id: products.id });

        if (row) {
          productId = row.id;
          result.created += 1;
        } else {
          const [existing] = await tx
            .select({ id: products.id })
            .from(products)
            .where(
              and(
                eq(products.supplierId, supplierId),
                eq(products.supplierSku, feed.supplierSku),
              ),
            )
            .limit(1);
          productId = existing?.id ?? null;
        }
      } else if (productId) {
        // The slug is deliberately NOT rewritten on update. It is in every link
        // and every search result; a renamed product must not break them.
        await tx
          .update(products)
          .set(productFields)
          .where(eq(products.id, productId));
        result.updated += 1;
      }

      if (!productId) continue;

      // Variants are handled after every product is resolved — see below.
      touched.push({ productId, feed });
    }

    /* ---- variants, in bulk ---- */

    /*
     * WHY THIS IS NOT DONE PER PRODUCT.
     *
     * It used to be: one SELECT per product, then one INSERT or UPDATE per
     * variant. Fristads' feed is small enough that nobody noticed. The You/F&H
     * export is 700 products and 12,402 variants, which is ~13,000 round trips
     * inside a single transaction — over an hour against a remote database, and
     * far past both the 300s route budget and the cron's 280s timeout. The
     * nightly import could never have finished.
     *
     * So: one SELECT for every product at once, then chunked writes.
     */
    if (touched.length > 0) {
      const existingVariants = await tx
        .select()
        .from(productVariants)
        .where(
          inArray(
            productVariants.productId,
            touched.map((t) => t.productId),
          ),
        );

      const byProduct = new Map<string, typeof existingVariants>();
      for (const v of existingVariants) {
        const list = byProduct.get(v.productId) ?? [];
        list.push(v);
        byProduct.set(v.productId, list);
      }

      const inserts: (typeof productVariants.$inferInsert)[] = [];
      const updates: { id: string; values: ReturnType<typeof variantValues> }[] = [];
      const gone: string[] = [];

      for (const { productId, feed } of touched) {
        const existing = byProduct.get(productId) ?? [];
        const existingByAlias = indexByAlias(existing);

        /*
         * Matched rows are tracked by ID, not by key. A stored variant answers
         * to several aliases and the feed may match it on any of them, so
         * comparing key sets afterwards would mark a variant we just updated
         * as gone.
         */
        const matchedIds = new Set<string>();

        for (const v of feed.variants) {
          const match = matchVariant(v, existingByAlias);
          const values = variantValues(productId, v);

          if (match) {
            matchedIds.add(match.id);
            updates.push({ id: match.id, values });
          } else {
            inserts.push({
              ...values,
              // A brand-new variant from a feed that publishes no stock starts
              // at zero. There is nothing else honest to write — we have never
              // seen a quantity for it.
              stockQty: values.stockQty ?? 0,
            });
          }
        }

        // A size the supplier stopped making. Deactivated, not deleted — an
        // order line points at it.
        for (const v of existing) {
          if (v.isActive && !matchedIds.has(v.id)) gone.push(v.id);
        }
      }

      // Postgres allows 65535 bind parameters per statement; these rows carry
      // ~15 columns each, so a thousand at a time stays well inside it.
      const CHUNK = 1000;

      for (let i = 0; i < inserts.length; i += CHUNK) {
        await tx.insert(productVariants).values(inserts.slice(i, i + CHUNK));
      }

      /*
       * Updates go in one statement per chunk, not one per row. 60 changed
       * products came to ~1,200 updates on the first You run — 1,200 round
       * trips, most of the five and a half minutes that run took.
       *
       * Stock is merged with coalesce rather than assigned: a feed that
       * publishes no quantity sends null, and null must mean "leave it" rather
       * than "set it to nothing". stock_updated_at moves only when a real
       * figure arrived, so the shop never claims a stale count was just
       * confirmed.
       */
      for (let i = 0; i < updates.length; i += CHUNK) {
        const chunk = updates.slice(i, i + CHUNK);

        // Casts are explicit because a VALUES column that happens to be null in
        // every row of a chunk has no type Postgres can infer.
        const rows = chunk.map(({ id, values }) =>
          sql`(${id}::uuid, ${values.sku}::text, ${values.ean}::text,
               ${values.colourName}::text, ${values.colourHex}::text,
               ${values.size}::text, ${values.fit}::text,
               ${values.listPriceDkk}::numeric, ${values.netPriceDkk}::numeric,
               ${values.stockQty ?? null}::int,
               ${values.stockTracked}::boolean,
               ${values.stockIncoming ? JSON.stringify(values.stockIncoming) : null}::jsonb,
               ${JSON.stringify(values.imageUrls ?? [])}::jsonb)`,
        );

        await tx.execute(sql`
          update product_variants v set
            sku              = t.sku,
            ean              = t.ean,
            colour_name      = t.colour_name,
            colour_hex       = t.colour_hex,
            size             = t.size,
            fit              = t.fit,
            list_price_dkk   = t.list_price,
            net_price_dkk    = t.net_price,
            stock_tracked    = t.stock_tracked,
            stock_qty        = coalesce(t.stock_qty, v.stock_qty),
            stock_updated_at = case when t.stock_qty is null
                                    then v.stock_updated_at else now() end,
            stock_incoming   = t.stock_incoming,
            -- Round-tripped through jsonb, not passed as a text[] parameter.
            -- Drizzle expands a JS array inside an sql template into one bind
            -- parameter PER ELEMENT, so casting it to text[] produced
            -- "($1, $2)::text[]" and the statement failed to parse.
            image_urls       = coalesce(
                                 (select array_agg(x)
                                    from jsonb_array_elements_text(t.image_urls) x),
                                 '{}'::text[]
                               ),
            is_active        = true,
            updated_at       = now()
          from (values ${sql.join(rows, sql`, `)})
            as t(id, sku, ean, colour_name, colour_hex, size, fit,
                 list_price, net_price, stock_qty, stock_tracked, stock_incoming,
                 image_urls)
          where v.id = t.id
        `);
      }

      for (let i = 0; i < gone.length; i += CHUNK) {
        await tx
          .update(productVariants)
          .set({ isActive: false, updatedAt: new Date() })
          .where(inArray(productVariants.id, gone.slice(i, i + CHUNK)));
      }
    }
  });

  // The catalogue just changed, so every cached read of it is now wrong.
  await revalidatePublicCatalogue();

  return result;
}
