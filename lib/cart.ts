import {
  isLogoMethod,
  isLogoPlacement,
  logoSignature,
  sortLogos,
  type CartLogo,
} from "@/lib/shop/logo";

/**
 * Cart shape shared by the client store and the server actions.
 *
 * Deliberately carries NO prices. The browser sends variant ids, quantities and
 * the chosen logo placements; every unit price, every decoration surcharge and
 * the account/personal split are recomputed on the server. A cart that carried
 * prices would be a cart a user could edit.
 */
export type CartItem = {
  variantId: string;
  qty: number;
  /** Chosen logo placements. Absent or empty means an undecorated garment. */
  logos?: CartLogo[];
};

const CART_STORAGE_PREFIX = "pdt_cart_v1";

/**
 * localStorage key, namespaced per signed-in user.
 *
 * Workwear shops get used on shared terminals in a warehouse or a site office.
 * A single global key meant the next person to sign in inherited the previous
 * one's basket — their sizes, their logo choices, on their allowance.
 */
export function cartStorageKey(scope: string): string {
  return `${CART_STORAGE_PREFIX}:${scope}`;
}

/**
 * Identity of a cart line.
 *
 * The same jacket with a chest logo and the same jacket with a back logo are two
 * different things to produce, so they are two lines. Keying on the variant id
 * alone would silently merge them.
 */
export function cartLineKey(item: {
  variantId: string;
  logos?: CartLogo[];
}): string {
  const sig = logoSignature(item.logos);
  return sig ? `${item.variantId}|${sig}` : item.variantId;
}

function parseLogos(value: unknown): CartLogo[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const logos = value
    .filter(
      (l): l is CartLogo =>
        !!l && isLogoPlacement(l.placement) && isLogoMethod(l.method),
    )
    .map((l) => ({ placement: l.placement, method: l.method }));

  // One decoration per placement: two methods on the same spot is not a thing
  // that can be produced.
  const seen = new Set<string>();
  const unique = logos.filter((l) => {
    if (seen.has(l.placement)) return false;
    seen.add(l.placement);
    return true;
  });

  return unique.length ? sortLogos(unique).slice(0, 4) : undefined;
}

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
        logos: parseLogos(i.logos),
      }))
      .slice(0, 100);
  } catch {
    return [];
  }
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.qty, 0);
}
