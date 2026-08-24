import type { Locale } from "@/lib/i18n/locales";

/**
 * Logo placement and decoration method — the employee-facing half of the
 * prototype's "design manual".
 *
 * PLACEHOLDER PRICING. In the finished product these placements, methods and
 * surcharges come from a per-customer design manual (placement, method, size in
 * mm, PMS colours), so the print shop never guesses and every order carries the
 * same specification. That table does not exist yet, so the defaults below are
 * hard-coded here — in ONE place, imported by both the picker and the server
 * action, so the price the employee is shown is the price the server charges.
 *
 * The method ids match the `embellishment_method` enum in lib/db/schema/enums.ts.
 * `transfer` is deliberately not offered to employees: it is a production
 * decision, not a customer-facing choice.
 */

export const LOGO_METHODS = ["embroidery", "print"] as const;
export type LogoMethod = (typeof LOGO_METHODS)[number];

export const LOGO_PLACEMENTS = [
  "chest_left",
  "chest_right",
  "sleeve",
  "back_large",
] as const;
export type LogoPlacement = (typeof LOGO_PLACEMENTS)[number];

/** Surcharge in DKK per placement per method, excluding the first placement. */
const SURCHARGE: Record<LogoPlacement, Record<LogoMethod, number>> = {
  chest_left: { embroidery: 39, print: 29 },
  chest_right: { embroidery: 39, print: 29 },
  sleeve: { embroidery: 35, print: 25 },
  // A back print is materially bigger, so it costs more — as in the prototype.
  back_large: { embroidery: 89, print: 69 },
};

export type CartLogo = {
  placement: LogoPlacement;
  method: LogoMethod;
};

export function isLogoPlacement(value: unknown): value is LogoPlacement {
  return (
    typeof value === "string" &&
    (LOGO_PLACEMENTS as readonly string[]).includes(value)
  );
}

export function isLogoMethod(value: unknown): value is LogoMethod {
  return (
    typeof value === "string" && (LOGO_METHODS as readonly string[]).includes(value)
  );
}

/**
 * What the decoration adds to ONE garment.
 *
 * The first placement is included in the garment price; every further placement
 * is charged. Order matters, so the list is sorted into a stable order first —
 * otherwise the same two placements could cost different amounts depending on
 * which chip the employee happened to tap first.
 */
export function embellishmentCost(logos: CartLogo[]): number {
  const ordered = sortLogos(logos);
  return ordered
    .slice(1)
    .reduce((sum, l) => sum + (SURCHARGE[l.placement]?.[l.method] ?? 0), 0);
}

/** Price shown next to a placement chip before it is selected. */
export function placementSurcharge(
  placement: LogoPlacement,
  method: LogoMethod,
): number {
  return SURCHARGE[placement]?.[method] ?? 0;
}

/** Deterministic order: the placement list's own order, then method. */
export function sortLogos(logos: CartLogo[]): CartLogo[] {
  return [...logos].sort(
    (a, b) =>
      LOGO_PLACEMENTS.indexOf(a.placement) - LOGO_PLACEMENTS.indexOf(b.placement) ||
      a.method.localeCompare(b.method),
  );
}

/**
 * Stable identity for a cart line.
 *
 * Two of the same jacket with different logo placements are two different
 * things to make, so they must be two cart lines — the variant id alone is not
 * enough to key one.
 */
export function logoSignature(logos: CartLogo[] | undefined): string {
  if (!logos || logos.length === 0) return "";
  return sortLogos(logos)
    .map((l) => `${l.placement}:${l.method}`)
    .join("+");
}

/** Column value for order_lines.logo_placement — human-readable, order-stable. */
export function placementColumn(logos: CartLogo[] | undefined): string | null {
  if (!logos || logos.length === 0) return null;
  return sortLogos(logos)
    .map((l) => l.placement)
    .join(",");
}

/**
 * order_lines.logo_method holds ONE method, so a line decorated two ways stores
 * the first. The full per-placement detail lives in logo_placement until the
 * design manual gives every placement its own row.
 */
export function primaryMethod(logos: CartLogo[] | undefined): LogoMethod | null {
  if (!logos || logos.length === 0) return null;
  return sortLogos(logos)[0].method;
}

/** Short line for a cart row, e.g. "Bryst venstre (broderi) · Ryg (tryk)". */
export function describeLogos(
  logos: CartLogo[] | undefined,
  labels: { placements: Record<LogoPlacement, string>; methods: Record<LogoMethod, string> },
): string {
  if (!logos || logos.length === 0) return "";
  return sortLogos(logos)
    .map((l) => `${labels.placements[l.placement]} (${labels.methods[l.method]})`)
    .join(" · ");
}

/** Locale is accepted so callers can stay symmetrical with the money helpers. */
export function surchargeLabel(
  _locale: Locale,
  amount: number,
  includedLabel: string,
): string {
  return amount === 0 ? includedLabel : `+ ${amount} kr.`;
}
