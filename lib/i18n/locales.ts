/**
 * Locale constants with no runtime dependencies.
 *
 * Kept separate from lib/i18n/index.ts because that module imports
 * `next/root-params`, which is unavailable in proxy.ts and in Client Components.
 */
export const locales = ["da", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "da";

export function hasLocale(value: string | undefined): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export function otherLocale(locale: Locale): Locale {
  return locale === "da" ? "en" : "da";
}
