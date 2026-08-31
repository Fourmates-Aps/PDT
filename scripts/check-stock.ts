import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { checkAvailabilityForUpdate } from "@/lib/db/queries/availability";
import { listPackQueue } from "@/lib/db/queries/production";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Two checkouts, one jacket. Exactly one may win.
 *
 *   npm run check:stock              the guard as it ships — expect PASS
 *   npm run check:stock -- --no-lock the same check without `for update`
 *
 * Drives the function placeOrder calls, in two genuinely concurrent transactions
 * against the real database. Running them one after the other would pass without
 * proving anything — the bug only lives in the window where both transactions
 * are open at once.
 *
 * `--no-lock` is the control: it must FAIL, placing two orders against one unit.
 * A concurrency test that cannot fail is not evidence of anything.
 *
 * Seeds its own throwaway product, variant, member and auth user, and removes
 * them again — including on the paths where it reports FAIL.
 */

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
