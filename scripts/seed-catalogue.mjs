import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

/**
 * Imports a subset of the You (F&H Group) PIM feed into the product catalogue.
 *
 *   node scripts/seed-catalogue.mjs [--limit 60] [--clean]
 *
 * The full export in prototype/You_katalog_fuld.json is 700 products / 12,402
 * variants. A subset is enough to exercise the shop; the production path is the
 * scheduled feed adapter described in the dev brief, not this script.
 *
 * Marked with supplier_id 'FH_YOU' so --clean removes exactly what it added.
 *
 * Two things the real adapter must also do, done here:
 *  - Danish category names. The feed mixes Norwegian in ("Gensere",
 *    "Reiseeffekter"), which would surface untranslated in the shop.
 *  - CO2 recorded as available/unavailable rather than defaulting to zero.
 *    Only 237 of the 700 products carry a figure; zero would be a lie.
 */

const SUPPLIER = "FH_YOU";

const args = process.argv.slice(2);
const clean = args.includes("--clean");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 60;

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set — see .env.example");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });

/** Feed categories are a Norwegian/Danish mix; the shop must show Danish only. */
const CATEGORY_DA = {
  Gensere: "Sweatshirts",
  Reiseeffekter: "Rejseeffekter",
  "Treningstøy": "Træningstøj",
  Synlighetsartikler: "Synlighed",
  Handlenett: "Mulepose",
  Tennisskjorter: "Poloshirts",
  Accessories: "Tilbehør",
  Headwear: "Huer & caps",
};

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

async function doClean() {
  const [{ count }] = await sql`
    select count(*)::int as count from products where supplier_id = ${SUPPLIER}
  `;
  await sql`delete from products where supplier_id = ${SUPPLIER}`;
  console.log(`removed ${count} imported product(s) and their variants`);
  await sql.end();
}

async function doSeed() {
  const path = join(process.cwd(), "prototype", "You_katalog_fuld.json");
  const feed = JSON.parse(readFileSync(path, "utf8"));

  // Prefer products that have an image and at least one variant — a shop grid
  // full of placeholders tells you nothing about the design.
  const usable = feed.products.filter(
    (p) => p.image1 && p.variants?.length > 0 && p.name && p.category !== "Katalog",
  );

  // Spread across categories rather than taking the first N, which would be
  // 60 t-shirts and no sense of whether the filter works.
  const byCategory = new Map();
  for (const p of usable) {
    const list = byCategory.get(p.category) ?? [];
    list.push(p);
    byCategory.set(p.category, list);
  }

  const picked = [];
  let round = 0;
  while (picked.length < LIMIT) {
    let added = false;
    for (const list of byCategory.values()) {
      if (list[round]) {
        picked.push(list[round]);
        added = true;
        if (picked.length >= LIMIT) break;
      }
    }
    if (!added) break;
    round += 1;
  }

  const [org] = await sql`
    select id, default_allowance_dkk from organisations where slug = 'demo-vognmand-hansen'
  `;

  let productCount = 0;
  let variantCount = 0;
  const seenSlugs = new Set();

  for (const p of picked) {
    const category = CATEGORY_DA[p.category] ?? p.category;

    let slug = slugify(`${p.brand ?? "you"}-${p.name}-${p.productNr}`);
    while (seenSlugs.has(slug)) slug = `${slug}-x`;
    seenSlugs.add(slug);

    const co2 = typeof p.co2 === "number" && p.co2 > 0 ? p.co2 : null;

    const [product] = await sql`
      insert into products
        (supplier_id, supplier_sku, brand, name, slug, category, co2_kg, co2_available,
         primary_image, raw_data)
      values
        (${SUPPLIER}, ${p.productNr}, ${p.brand ?? "You"}, ${p.name}, ${slug},
         ${category}, ${co2}, ${co2 !== null}, ${p.image1},
         ${sql.json({ image2: p.image2 ?? null, priceVejl: p.priceVejl ?? null })})
      on conflict (supplier_id, supplier_sku) do nothing
      returning id
    `;
    if (!product) continue;
    productCount += 1;

    // Dealer price is our cost; the customer's price is set in org_pricing.
    const listPrice = Number(p.priceVejl ?? p.priceForhandler ?? 0) || 0;
    const netPrice = Number(p.priceNet ?? 0) || null;

    const seenEan = new Set();
    for (const v of p.variants) {
      // EAN is unique across the whole table; the feed repeats a few and has
      // 179 variants with none at all.
      const ean = v.ean && !seenEan.has(v.ean) ? v.ean : null;
      if (ean) seenEan.add(ean);

      const [variant] = await sql`
        insert into product_variants
          (product_id, ean, colour_name, colour_hex, size, list_price_dkk,
           net_price_dkk, stock_qty, stock_updated_at, image_urls)
        values
          (${product.id}, ${ean}, ${v.color ?? null}, ${v.hex ?? null}, ${v.size ?? null},
           ${listPrice}, ${netPrice},
           ${20 + Math.floor(Math.random() * 80)}, now(),
           ${sql.array([p.image1].filter(Boolean))})
        on conflict do nothing
        returning id
      `;
      if (variant) variantCount += 1;
    }

    if (org) {
      await sql`
        insert into org_assortment (organisation_id, product_id)
        values (${org.id}, ${product.id})
        on conflict do nothing
      `;

      // 35% margin on the dealer price, matching the prototype's default markup.
      await sql`
        insert into org_pricing (organisation_id, product_variant_id, price_dkk, margin_pct)
        select ${org.id}, pv.id, round(pv.list_price_dkk * 1.35, 2), 35
        from product_variants pv
        where pv.product_id = ${product.id}
        on conflict do nothing
      `;
    }
  }

  console.log(`products      ${productCount}`);
  console.log(`variants      ${variantCount}`);
  console.log(
    org
      ? `assortment    added to demo organisation, priced at +35%`
      : `assortment    SKIPPED — demo organisation not found, run seed:demo first`,
  );
  console.log("\nRemove again with: node scripts/seed-catalogue.mjs --clean");
  await sql.end();
}

try {
  if (clean) await doClean();
  else await doSeed();
} catch (error) {
  console.error("\nFailed:", error.message);
  process.exitCode = 1;
  await sql.end();
}
