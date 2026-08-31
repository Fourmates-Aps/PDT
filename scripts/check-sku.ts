import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { indexByAlias, matchVariant, variantAliases } from "@/lib/import/diff";
import { publishChanges } from "@/lib/import/publish";

/**
 * The variant SKU column and the matching that makes it safe to add.
 *
 *   npm run check:sku
 *
 * The risk in adding an identity column is not the column — it is the FIRST
 * IMPORT AFTER IT. Rows written before the column existed have sku = null and
 * are known only by their EAN. If the feed's SKU were the only thing matched on,
 * that run would find nothing, report the whole catalogue as discontinued and
 * re-create it — losing stock, images and every order line's variant.
 *
 * So the transition is what is tested here, not just the DDL.
 */

const TAG = "SKU-TEST";
let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const variant = (over: Partial<Record<string, unknown>> = {}) => ({
  sku: null as string | null,
  ean: null as string | null,
  colourName: "Navy",
  size: "L",
  colourHex: null,
  fit: null,
  listPriceDkk: "100.00",
  netPriceDkk: null,
  stockQty: 5,
  stockIncoming: null,
  imageUrls: [] as string[],
  ...over,
});

async function main() {
  console.log("\nAlias precedence (strongest identity first):");
  const aliases = variantAliases({ sku: "ART-1", ean: "5711", colourName: "Navy", size: "L" });
  check("sku ranks first", aliases[0] === "sku:ART-1", aliases.join(", "));
  check("ean second", aliases[1] === "ean:5711");
  check("colour+size last", aliases[2] === "cs:Navy|L");
  check(
    "namespaces are prefixed",
    !variantAliases({ sku: "5711", ean: null, colourName: null, size: null })
      .includes("ean:5711"),
    "a SKU must not be mistaken for an EAN of the same digits",
  );

  console.log("\nThe upgrade run — stored rows have no SKU yet:");
  const stored = [variant({ ean: "5711", colourName: "Navy", size: "L" })];
  const byAlias = indexByAlias(stored);
  const fromFeed = variant({ sku: "ART-1", ean: "5711", colourName: "Navy", size: "L" });
  check("feed variant matches the old row on EAN", matchVariant(fromFeed, byAlias) === stored[0]);

  const renamed = variant({ sku: "ART-1", ean: null, colourName: "Marine", size: "L" });
  const afterSku = indexByAlias([variant({ sku: "ART-1", ean: "5711", colourName: "Navy", size: "L" })]);
  check(
    "a renamed colour still matches once both sides carry the SKU",
    matchVariant(renamed, afterSku) !== undefined,
    "this is the failure the column exists to end",
  );

  const unrelated = variant({ sku: "ART-9", ean: "9999", colourName: "Red", size: "S" });
  check("an unrelated variant does not match", matchVariant(unrelated, byAlias) === undefined);

  console.log("\nAgainst the real database:");
  const [org] = await db.execute<{ id: string }>(sql`select id from organisations limit 1`);
  if (!org) throw new Error("No organisation.");

  const [product] = await db.execute<{ id: string }>(sql`
    insert into products (supplier_id, supplier_sku, brand, name, category, slug)
    values (${TAG}, ${TAG + "-STYLE"}, ${TAG}, 'SKU test jacket', 'Jakker', ${"sku-test-jacket"})
    returning id
  `);

  // A row as it would exist from before the column was added.
  await db.execute(sql`
    insert into product_variants (product_id, ean, colour_name, size, list_price_dkk, stock_qty)
    values (${product.id}, '5711', 'Navy', 'L', 100, 7)
  `);

  // Now publish a feed that carries the SKU for that same variant.
  await publishChanges(TAG, [
    {
      type: "updated",
      supplierSku: TAG + "-STYLE",
      productId: product.id,
      before: null,
      after: {
        supplierSku: TAG + "-STYLE",
        brand: TAG,
        name: "SKU test jacket",
        nameEn: null,
        category: "Jakker",
        subcategory: null,
        gender: null,
        material: null,
        primaryImage: null,
        co2Kg: null,
        co2Available: false,
        variants: [variant({ sku: "ART-1", ean: "5711", colourName: "Navy", size: "L", stockQty: 7 })],
      },
      summary: "sku backfill",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  ]);

  const rows = await db.execute<{ id: string; sku: string | null; is_active: boolean; stock_qty: number }>(sql`
    select id, sku, is_active, stock_qty from product_variants where product_id = ${product.id}
  `);

  check("still exactly one variant row", rows.length === 1, `${rows.length} rows`);
  check("the SKU was written to the existing row", rows[0]?.sku === "ART-1", String(rows[0]?.sku));
  check("it was not discontinued", rows[0]?.is_active === true);

  console.log("\nThe unique index:");
  const dup = await db
    .execute(sql`
      insert into product_variants (product_id, sku, colour_name, size, list_price_dkk, stock_qty)
      values (${product.id}, 'ART-1', 'Red', 'S', 100, 1)
    `)
    .then(() => "allowed")
    .catch(() => "rejected");
  check("the same SKU twice in one product is rejected", dup === "rejected");

  const [other] = await db.execute<{ id: string }>(sql`
    insert into products (supplier_id, supplier_sku, brand, name, category, slug)
    values (${TAG + "2"}, ${TAG + "-STYLE2"}, ${TAG}, 'Other', 'Jakker', ${"sku-test-other"})
    returning id
  `);
  const cross = await db
    .execute(sql`
      insert into product_variants (product_id, sku, colour_name, size, list_price_dkk, stock_qty)
      values (${other.id}, 'ART-1', 'Navy', 'L', 100, 1)
    `)
    .then(() => "allowed")
    .catch(() => "rejected");
  check("the same SKU under a different supplier's product is allowed", cross === "allowed");

  const nulls = await db
    .execute(sql`
      insert into product_variants (product_id, colour_name, size, list_price_dkk, stock_qty)
      values (${other.id}, 'Green', 'M', 100, 1), (${other.id}, 'Green', 'XL', 100, 1)
    `)
    .then(() => "allowed")
    .catch((e) => String(e.message));
  check("several variants may have no SKU at all", nulls === "allowed", String(nulls));

  await db.execute(sql`delete from product_variants where product_id in (${product.id}, ${other.id})`);
  await db.execute(sql`delete from products where supplier_id in (${TAG}, ${TAG + "2"})`);
  console.log("\nFixture removed.");
  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  if (failures > 0) process.exitCode = 1;
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => { console.error(e); process.exit(1); });
