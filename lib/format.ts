import type { Locale } from "@/lib/i18n/locales";

const INTL: Record<Locale, string> = { da: "da-DK", en: "en-GB" };

/**
 * Amounts arrive from Drizzle `numeric` columns as strings, deliberately — they
 * are decimal and must not be round-tripped through a float on the way to a
 * total. Parsing happens here, at the display edge, and nowhere else.
 */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(
  locale: Locale,
  value: string | number | null | undefined,
  opts: { decimals?: boolean } = {},
): string {
  const n = toNumber(value);
  const formatted = new Intl.NumberFormat(INTL[locale], {
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  }).format(n);
  return `${formatted} kr.`;
}

/** Points mode hides kroner entirely — 1 point maps to 1 DKK. */
export function formatAllowance(
  locale: Locale,
  value: string | number | null | undefined,
  mode: "price" | "points",
  pointsLabel: string,
): string {
  if (mode === "points") {
    const n = Math.round(toNumber(value));
    return `${new Intl.NumberFormat(INTL[locale]).format(n)} ${pointsLabel}`;
  }
  return formatMoney(locale, value);
}

export function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(INTL[locale]).format(value);
}

export function formatDate(
  locale: Locale,
  value: Date | string | null | undefined,
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(INTL[locale], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/**
 * Share of an allowance already spent, clamped for use as a bar width.
 * Accepts null because quota columns arrive nullable from a LEFT JOIN when an
 * employee has no allowance for the period yet.
 */
export function usagePct(
  used: string | number | null | undefined,
  allowance: string | number | null | undefined,
) {
  const a = toNumber(allowance);
  if (a <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((toNumber(used) / a) * 100)));
}
