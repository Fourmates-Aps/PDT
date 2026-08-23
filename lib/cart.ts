/**
 * Cart shape shared by the client store and the server actions.
 *
 * Deliberately carries NO prices. The browser sends variant ids and quantities;
 * the server re-reads org_pricing for every line. A cart that carried prices
 * would be a cart a user could edit.
 */
export type CartItem = {
  variantId: string;
  qty: number;
};

export const CART_STORAGE_KEY = "pdt_cart_v1";

/** Guards against a hand-edited localStorage value or a stale schema. */
export function parseCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (i): i is CartItem =>
          i &&
          typeof i.variantId === "string" &&
          i.variantId.length > 0 &&
          Number.isFinite(i.qty),
      )
      .map((i) => ({
        variantId: i.variantId,
        qty: Math.max(1, Math.min(999, Math.trunc(i.qty))),
      }))
      .slice(0, 100);
  } catch {
    return [];
  }
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.qty, 0);
}
