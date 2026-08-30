import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { productVariants, products } from "@/lib/db/schema";
import { revalidatePublicCatalogue } from "@/lib/db/queries/public-catalogue";
import { variantKey, type Change } from "./diff";
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
    ean: v.ean,
    colourName: v.colourName,
    colourHex: v.colourHex,
    size: v.size,
    fit: v.fit,
    listPriceDkk: v.listPriceDkk ?? "0",
    netPriceDkk: v.netPriceDkk,
    stockQty: v.stockQty,
    stockIncoming: v.stockIncoming,
    stockUpdatedAt: new Date(),
    imageUrls: v.imageUrls,
    isActive: true,
  };
}

export async function publishChanges(
  supplierId: string,
  changes: Change[],
): Promise<PublishResult> {
  const result: PublishResult = { created: 0, updated: 0, discontinued: 0 };

  await db.transaction(async (tx) => {
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

      /* ---- variants ---- */
      const existingVariants = await tx
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, productId));

      const existingByKey = new Map(
        existingVariants.map((v) => [variantKey(v), v]),
      );
      const feedKeys = new Set<string>();

      for (const v of feed.variants) {
        const key = variantKey(v);
        feedKeys.add(key);
        const match = existingByKey.get(key);

        if (match) {
          await tx
            .update(productVariants)
            .set({ ...variantValues(productId, v), updatedAt: new Date() })
            .where(eq(productVariants.id, match.id));
        } else {
          await tx.insert(productVariants).values(variantValues(productId, v));
        }
      }

      // A size the supplier stopped making. Deactivated, not deleted — an order
      // line points at it.
      const gone = existingVariants
        .filter((v) => v.isActive && !feedKeys.has(variantKey(v)))
        .map((v) => v.id);

      if (gone.length > 0) {
        await tx
          .update(productVariants)
          .set({ isActive: false, updatedAt: new Date() })
          .where(inArray(productVariants.id, gone));
      }
    }
  });

  // The catalogue just changed, so every cached read of it is now wrong.
  await revalidatePublicCatalogue();

  return result;
}
