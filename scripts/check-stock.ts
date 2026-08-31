import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { checkAvailabilityForUpdate } from "@/lib/db/queries/availability";
import { listPackQueue } from "@/lib/db/queries/production";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];



const TAG = "RACE-TEST";

/** Control: the same check WITHOUT `for update`, to show the lock is what works. */
const NO_LOCK = process.argv.includes("--no-lock");

async function unlockedCheck(tx: Tx, variantId: string, qty: number) {
  const rows = await tx.execute<{ available: number }>(sql`
    select v.stock_qty - coalesce((
             select sum(ol.quantity) from order_lines ol
               join orders o on o.id = ol.order_id
              where ol.product_variant_id = v.id
                and o.status in ('pending_approval','booked','arrived_at_warehouse','sent_to_print')
                and o.dispatched_at is null), 0) as available
      from product_variants v where v.id = ${variantId}
  `);
  const available = Number(rows[0].available);
  return qty > available ? [{ variantId, wanted: qty, available }] : [];
}

async function attempt(label: string, variantId: string, orgId: string, memberId: string) {
  try {
    return await db.transaction(async (tx) => {
      const shortfalls = NO_LOCK
        ? await unlockedCheck(tx, variantId, 1)
        : await checkAvailabilityForUpdate(tx, [{ variantId, qty: 1 }]);
      if (shortfalls.length > 0) {
        return `${label}: REFUSED (wanted ${shortfalls[0].wanted}, available ${shortfalls[0].available})`;
      }

      // Both transactions pause here on purpose: each has passed its check
      // before either writes. Without the lock, both would commit.
      await new Promise((r) => setTimeout(r, 400));

      const [order] = await tx.execute<{ id: string }>(sql`
        insert into orders (organisation_id, member_id, order_number, status,
                            payment_method, account_amount_dkk, personal_amount_dkk, total_dkk)
        values (${orgId}, ${memberId}, ${`${TAG}-${label}`}, 'booked',
                'account', 0, 0, 0)
        returning id
      `);

      await tx.execute(sql`
        insert into order_lines (order_id, organisation_id, product_variant_id,
                                 quantity, unit_price_dkk, line_total_dkk)
        values (${order.id}, ${orgId}, ${variantId}, 1, 0, 0)
      `);

      return `${label}: PLACED`;
    });
  } catch (error) {
    return `${label}: ERROR ${error instanceof Error ? error.message : error}`;
  }
}

async function main() {
  const [org] = await db.execute<{ id: string }>(sql`select id from organisations limit 1`);
  if (!org) throw new Error("No organisation.");

  console.log("Seeding a throwaway product, variant and member…");
  const [user] = await db.execute<{ id: string }>(sql`
    insert into auth.users (id, email)
    values (gen_random_uuid(), ${`race-test@${TAG.toLowerCase()}.invalid`})
    returning id
  `);
  const [member] = await db.execute<{ id: string }>(sql`
    insert into organisation_members (organisation_id, user_id, role, full_name)
    values (${org.id}, ${user.id}, 'employee', ${TAG})
    returning id
  `);
  const [product] = await db.execute<{ id: string }>(sql`
    insert into products (supplier_id, supplier_sku, brand, name, category, slug)
    values (${TAG}, ${TAG + "-SKU"}, ${TAG}, ${"Race test jacket"}, ${"Jakker"}, ${"race-test-jacket"})
    returning id
  `);
  const [variant] = await db.execute<{ id: string }>(sql`
    insert into product_variants (product_id, colour_name, size, list_price_dkk, stock_qty, is_active)
    values (${product.id}, 'Black', 'L', 100, 1, true)
    returning id
  `);
  console.log(`Variant ${variant.id} — stock_qty 1, nothing committed.\n`);

  console.log(
    NO_LOCK
      ? "CONTROL — same check, no row lock:"
      : "Two checkouts, both for the last unit, at the same time:",
  );
  const results = await Promise.all([
    attempt("A", variant.id, org.id, member.id),
    attempt("B", variant.id, org.id, member.id),
  ]);
  results.forEach((r) => console.log("  " + r));

  const [after] = await db.execute<{ n: number }>(sql`
    select coalesce(sum(ol.quantity), 0)::int as n
      from order_lines ol join orders o on o.id = ol.order_id
     where ol.product_variant_id = ${variant.id}
       and o.status in ('pending_approval','booked','arrived_at_warehouse','sent_to_print')
       and o.dispatched_at is null
  `);

  const placed = results.filter((r) => r.includes("PLACED")).length;
  console.log(`\nOrders placed: ${placed} (expected 1)`);
  console.log(`Units now committed against 1 in stock: ${after.n} (expected 1)`);
  const good = placed === 1 && after.n === 1;
  console.log(NO_LOCK ? (good ? "PASS (unexpected)" : "FAIL — as expected without the lock") : (good ? "PASS" : "FAIL"));

  if (!NO_LOCK) {
    /*
     * Second scenario: ONE cart, same variant on two lines — the same shirt with
     * two different logo placements. Checking the lines separately would let
     * 2 + 2 through while only 3 remain.
     */
    await db.execute(sql`update product_variants set stock_qty = 3 where id = ${variant.id}`);
    await db.execute(sql`delete from order_lines where product_variant_id = ${variant.id}`);
    await db.execute(sql`delete from orders where order_number like ${TAG + "%"}`);

    const twoLines = await db.transaction((tx) =>
      checkAvailabilityForUpdate(tx, [
        { variantId: variant.id, qty: 2 },
        { variantId: variant.id, qty: 2 },
      ]),
    );
    const withinStock = await db.transaction((tx) =>
      checkAvailabilityForUpdate(tx, [
        { variantId: variant.id, qty: 2 },
        { variantId: variant.id, qty: 1 },
      ]),
    );

    console.log("\nOne cart, same variant on two lines, 3 in stock:");
    console.log(
      `  2 + 2 = 4 → ${twoLines.length > 0 ? `refused (wanted ${twoLines[0].wanted}, available ${twoLines[0].available})` : "ALLOWED — wrong"}`,
    );
    console.log(
      `  2 + 1 = 3 → ${withinStock.length === 0 ? "allowed" : "refused — wrong"}`,
    );
    console.log(
      twoLines.length === 1 && twoLines[0].wanted === 4 && withinStock.length === 0
        ? "PASS"
        : "FAIL",
    );
  }

  if (!NO_LOCK) {
    /*
     * Third scenario: the supplier REVISES STOCK DOWN after orders were taken.
     * Checkout cannot prevent this — the units were available when both orders
     * were placed. The pack queue is where it has to surface, and it must point
     * at the LATER order, not the earlier one.
     */
    await db.execute(sql`delete from order_lines where product_variant_id = ${variant.id}`);
    await db.execute(sql`delete from orders where order_number like ${TAG + "%"}`);
    await db.execute(sql`update product_variants set stock_qty = 2 where id = ${variant.id}`);

    for (const [label, ago] of [["FIRST", "2 hours"], ["SECOND", "1 hour"]] as const) {
      const [o] = await db.execute<{ id: string }>(sql`
        insert into orders (organisation_id, member_id, order_number, status, payment_method,
                            account_amount_dkk, personal_amount_dkk, total_dkk, created_at)
        values (${org.id}, ${member.id}, ${`${TAG}-${label}`}, 'booked', 'account',
                0, 0, 0, now() - ${sql.raw(`interval '${ago}'`)})
        returning id
      `);
      await db.execute(sql`
        insert into order_lines (order_id, organisation_id, product_variant_id, quantity,
                                 unit_price_dkk, line_total_dkk)
        values (${o.id}, ${org.id}, ${variant.id}, 1, 0, 0)
      `);
    }

    console.log("\nTwo orders for 1 unit each, then the supplier feed drops stock 2 → 1:");
    await db.execute(sql`update product_variants set stock_qty = 1 where id = ${variant.id}`);

    const queue = await listPackQueue(50);
    const mine = queue.filter((o) => o.orderNumber.startsWith(TAG));
    const flags = new Map(
      mine.map((o) => [o.orderNumber.replace(`${TAG}-`, ""), o.lines[0]?.available]),
    );
    console.log(`  ${TAG}-FIRST  (placed first)  → available: ${flags.get("FIRST")}`);
    console.log(`  ${TAG}-SECOND (placed second) → available: ${flags.get("SECOND")}`);
    console.log(
      flags.get("FIRST") === true && flags.get("SECOND") === false
        ? "PASS"
        : "FAIL — the shortfall must land on the later order",
    );
  }

  if (!NO_LOCK) {
    /*
     * Fourth scenario: a variant the supplier publishes NO stock for.
     *
     * You/F&H keep quantities in a B2B portal, so stock_qty stays 0 and means
     * "no information", not "none left". These must stay orderable — PDT buys
     * them in per order — while a tracked variant in the SAME cart must still
     * be refused when it genuinely runs out.
     */
    await db.execute(sql`delete from order_lines where product_variant_id = ${variant.id}`);
    await db.execute(sql`delete from orders where order_number like ${TAG + "%"}`);
    await db.execute(sql`
      update product_variants set stock_qty = 0, stock_tracked = false where id = ${variant.id}
    `);

    const untracked = await db.transaction((tx) =>
      checkAvailabilityForUpdate(tx, [{ variantId: variant.id, qty: 500 }]),
    );

    console.log("\nUntracked variant (supplier publishes no stock), stock_qty 0:");
    console.log(
      `  order 500 → ${untracked.length === 0 ? "allowed" : `REFUSED (${JSON.stringify(untracked[0])})`}`,
    );

    // Two at once, both for far more than the stored 0.
    const both = await Promise.all([
      db.transaction((tx) => checkAvailabilityForUpdate(tx, [{ variantId: variant.id, qty: 50 }])),
      db.transaction((tx) => checkAvailabilityForUpdate(tx, [{ variantId: variant.id, qty: 50 }])),
    ]);
    console.log(
      `  two concurrent orders → ${both.every((r) => r.length === 0) ? "both allowed" : "one refused — wrong"}`,
    );

    // A second variant that IS tracked, to prove the guard still bites.
    const [tracked] = await db.execute<{ id: string }>(sql`
      insert into product_variants (product_id, colour_name, size, list_price_dkk, stock_qty, stock_tracked)
      values (${product.id}, 'Blue', 'M', 100, 1, true)
      returning id
    `);

    const mixed = await db.transaction((tx) =>
      checkAvailabilityForUpdate(tx, [
        { variantId: variant.id, qty: 99 },   // untracked — fine
        { variantId: tracked.id, qty: 5 },    // tracked, only 1 in stock
      ]),
    );
    console.log(
      `  mixed cart (untracked 99 + tracked 5 of 1) → ${
        mixed.length === 1 && mixed[0].variantId === tracked.id
          ? "only the tracked line refused"
          : `wrong: ${JSON.stringify(mixed)}`
      }`,
    );

    console.log(
      untracked.length === 0 &&
        both.every((r) => r.length === 0) &&
        mixed.length === 1 &&
        mixed[0].variantId === tracked.id
        ? "PASS"
        : "FAIL",
    );

    await db.execute(sql`delete from product_variants where id = ${tracked.id}`);
  }

  // Cleanup, innermost first.
  await db.execute(sql`delete from order_lines where product_variant_id = ${variant.id}`);
  await db.execute(sql`delete from orders where order_number like ${TAG + "%"}`);
  await db.execute(sql`delete from product_variants where product_id = ${product.id}`);
  await db.execute(sql`delete from products where id = ${product.id}`);
  await db.execute(sql`delete from organisation_members where id = ${member.id}`);
  await db.execute(sql`delete from auth.users where id = ${user.id}`);
  console.log("Fixture removed.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message ?? e); process.exit(1); });
