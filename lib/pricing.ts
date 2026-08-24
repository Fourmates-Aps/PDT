/**
 * Margin maths, in one place.
 *
 * Two numbers get confused constantly and mean different things:
 *
 *   avance / påslag (markup)   = (sale − cost) / COST
 *   dækningsgrad (DG, margin)  = (sale − cost) / SALE
 *
 * A 100 % markup is a 50 % DG. The prototype's Prissætning screen sets the
 * first and is measured against the second — `minimum_dg_pct` is the floor a
 * KAM may not price below — so both live here rather than being re-derived,
 * differently, on each screen.
 *
 * All amounts are DKK excluding VAT.
 */

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Sale price for a cost at a given markup percentage. */
export function salePrice(cost: number, markupPct: number): number {
  if (!Number.isFinite(cost) || cost <= 0) return 0;
  return round2(cost * (1 + markupPct / 100));
}

/** Contribution margin of a sale price over a cost, as a percentage. */
export function dgPct(cost: number, sale: number): number | null {
  if (!Number.isFinite(sale) || sale <= 0) return null;
  if (!Number.isFinite(cost) || cost <= 0) return null;
  return round2(((sale - cost) / sale) * 100);
}

/** Markup implied by a sale price over a cost, as a percentage. */
export function markupPct(cost: number, sale: number): number | null {
  if (!Number.isFinite(cost) || cost <= 0) return null;
  return round2(((sale - cost) / cost) * 100);
}

/**
 * The markup that lands exactly on a target DG.
 *
 * A 100 % DG would need an infinite markup, so anything at or above it is
 * rejected rather than returned as a number nobody can price against.
 */
export function markupForDg(targetDgPct: number): number | null {
  if (!Number.isFinite(targetDgPct) || targetDgPct >= 100 || targetDgPct < 0) {
    return null;
  }
  const dg = targetDgPct / 100;
  return round2((dg / (1 - dg)) * 100);
}

/** Raises a price by a percentage — the prototype's "prisstigning". */
export function uplift(price: number, pct: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  return round2(price * (1 + pct / 100));
}

/** Applies a customer discount to a list price. */
export function afterDiscount(price: number, discountPct: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  const pct = Math.min(100, Math.max(0, discountPct));
  return round2(price * (1 - pct / 100));
}

export type MarginTone = "ok" | "warning" | "under";

/**
 * How a row should read against the customer's floor.
 *
 * `under` is a hard fail — the price is below the agreed minimum DG and the
 * shop must not be activated on it. `warning` is within two points of the
 * floor, which is where rounding or a supplier price rise tips it over.
 */
export function marginTone(
  dg: number | null,
  minimumDg: number,
): MarginTone | null {
  if (dg === null) return null;
  if (dg < minimumDg) return "under";
  if (dg < minimumDg + 2) return "warning";
  return "ok";
}
