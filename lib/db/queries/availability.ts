import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * The transaction handle, taken from Drizzle rather than typed as `any`.
 *
 * `any` here cost the generic on `tx.execute<T>()`, which silently degraded every
 * column read out of the lock query to `{}` — the compiler stopped checking the
 * one function whose arithmetic decides whether an order is allowed.
 */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * How much of a variant can still be promised to somebody.
 *
 * WHAT `product_variants.stock_qty` ACTUALLY IS. It is the SUPPLIER's stock,
 * arriving from a batch feed — "as fresh as the last sync", in the integration
 * note's words. It is not a count of goods on a shelf in Vejle: D-3 makes
 * "Ankommet på lager" a customer-visible stage precisely because PDT buys in per
 * order. So reserving stock cannot mean decrementing a warehouse counter, because
 * there is no warehouse counter to decrement — and the next feed import would
 * overwrite it anyway.
 *
 * WHAT RESERVATION MEANS HERE. Availability is what the supplier has, minus what
 * we have already promised to orders that are still owed:
 *
 *     available = stock_qty − Σ quantity on open, undispatched order lines
 *
 * DERIVED, NOT STORED. There is no reservations table. Orders are the single
 * source of truth, so a cancelled or rejected order releases its hold for free —
 * it simply stops matching OPEN_STATUSES. A parallel table would need releasing
 * by hand in five places and would drift the first time one was missed.
 *
 * TODO(stripe): a payment authorisation needs a hold BEFORE an order exists.
 * When Stripe lands, add a short-lived `stock_reservations` table for that
 * window and subtract it here too — one extra term in this function, and
 * everything that calls it keeps working.
 */

/**
 * Statuses that still owe goods to a customer.
 *
 * `pending_approval` is included on purpose. Checkout already reserves the
 * employee's allowance before approval so orders cannot be stacked past a
 * budget; stock behaves the same way, or two people fill in a form for the last
 * jacket and both are told yes.
 */
export const OPEN_STATUSES = [
  "pending_approval",
  "booked",
  "arrived_at_warehouse",
  "sent_to_print",
] as const;

export type Availability = {
  variantId: string;
  /** What the supplier's last feed said they hold. Meaningless when untracked. */
  stockQty: number;
  /** Already promised to open orders. */
  committed: number;
  /**
   * stockQty − committed, floored at zero — or NULL when the variant is not
   * stock-tracked, meaning there is no limit to enforce because the supplier
   * publishes no quantities and the goods are bought in per order.
   *
   * Null is not "unknown, so refuse". It is "this is not the kind of thing we
   * count", and the caller must not treat it as zero.
   */
  available: number | null;
  /** False when the supplier publishes no stock — see products schema. */
  tracked: boolean;
};

/* Reusable so the lock, the read and the pack queue cannot drift apart. */
const COMMITTED = sql`
  coalesce((
    select sum(ol.quantity)
      from order_lines ol
      join orders o on o.id = ol.order_id
     where ol.product_variant_id = v.id
       and o.status in ('pending_approval', 'booked', 'arrived_at_warehouse', 'sent_to_print')
       -- Dispatched means the parcel has gone: the goods are no longer owed,
       -- even though the order sits at its stage until GLS confirms delivery.
       and o.dispatched_at is null
  ), 0)::int
`;

/** Availability for a set of variants. Read-only — no locking. */
export async function getAvailability(
  variantIds: string[],
): Promise<Map<string, Availability>> {
  if (variantIds.length === 0) return new Map();

  const rows = await db.execute<{
    id: string;
    stock_qty: number;
    stock_tracked: boolean;
    committed: number;
  }>(sql`
    select v.id, v.stock_qty, v.stock_tracked, ${COMMITTED} as committed
      from product_variants v
     where v.id in ${variantIds}
  `);

  return new Map(
    rows.map((r) => [
      r.id,
      {
        variantId: r.id,
        stockQty: Number(r.stock_qty),
        committed: Number(r.committed),
        available: r.stock_tracked
          ? Math.max(0, Number(r.stock_qty) - Number(r.committed))
          : null,
        tracked: r.stock_tracked,
      },
    ]),
  );
}

export type StockShortfall = {
  variantId: string;
  wanted: number;
  available: number;
};

/**
 * Lock the variants, then check what is left — for use INSIDE a transaction.
 *
 * The lock is the whole point. Two checkouts for the last jacket would otherwise
 * both read `available: 1`, both decide they are fine, and both insert; the
 * shortfall only surfaces days later when a picker cannot find the second one.
 * `for update` makes the second transaction wait until the first has committed
 * its order line, so it sees the real remaining figure.
 *
 * Rows are locked in a deterministic order, because two carts holding the same
 * two variants in opposite orders is a deadlock.
 */
export async function checkAvailabilityForUpdate(
  tx: Tx,
  wanted: { variantId: string; qty: number }[],
): Promise<StockShortfall[]> {
  if (wanted.length === 0) return [];

  const ids = [...new Set(wanted.map((w) => w.variantId))].sort();

  await tx.execute(sql`
    select id from product_variants
     where id in ${ids}
     order by id
       for update
  `);

  const rows = await tx.execute<{
    id: string;
    stock_qty: number;
    stock_tracked: boolean;
    committed: number;
  }>(sql`
    select v.id, v.stock_qty, v.stock_tracked, ${COMMITTED} as committed
      from product_variants v
     where v.id in ${ids}
  `);

  /*
   * Untracked variants are absent from this map entirely, and the loop below
   * skips anything it cannot find a LIMIT for. Mapping them to 0 would refuse
   * every order for a supplier who simply does not publish quantities.
   */
  const byId = new Map<string, number>();
  for (const r of rows) {
    if (!r.stock_tracked) continue;
    byId.set(r.id, Math.max(0, Number(r.stock_qty) - Number(r.committed)));
  }

  /*
   * Quantities are summed per variant first. A cart can legitimately hold the
   * same variant on two lines — the same shirt with two different logo
   * placements — and checking the lines separately would let 2 + 2 through when
   * only 3 are left.
   */
  const totals = new Map<string, number>();
  for (const line of wanted) {
    totals.set(line.variantId, (totals.get(line.variantId) ?? 0) + line.qty);
  }

  const shortfalls: StockShortfall[] = [];
  for (const [variantId, qty] of totals) {
    const available = byId.get(variantId);
    // Not in the map means untracked — nothing to enforce. A variant that does
    // not exist at all was already rejected by pricing, which refuses to price
    // anything outside the organisation's assortment.
    if (available === undefined) continue;
    if (qty > available) {
      shortfalls.push({ variantId, wanted: qty, available });
    }
  }

  return shortfalls;
}
