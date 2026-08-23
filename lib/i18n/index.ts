import { lang } from "next/root-params";
import { notFound } from "next/navigation";
import { da, type Dictionary } from "./da";
import { en } from "./en";
import { defaultLocale, hasLocale, locales, type Locale } from "./locales";

const dictionaries: Record<Locale, Dictionary> = { da, en };

export type { Dictionary, Locale };
export { locales, defaultLocale, hasLocale };
export { otherLocale } from "./locales";

/**
 * Resolves the dictionary for the current route.
 *
 * `lang()` is a root parameter getter, so any Server Component can call this without
 * the locale being threaded down as a prop. It is unavailable in Client Components,
 * Server Actions and Route Handlers — those receive the locale explicitly instead.
 */
export async function getDictionary(): Promise<Dictionary> {
  const locale = await lang();
  if (!hasLocale(locale)) notFound();
  return dictionaries[locale];
}

export async function getLocale(): Promise<Locale> {
  const locale = await lang();
  if (!hasLocale(locale)) notFound();
  return locale;
}

/** Locale-aware dictionary lookup for contexts without root params (e.g. Route Handlers). */
export function dictionaryFor(locale: string | undefined): Dictionary {
  return hasLocale(locale) ? dictionaries[locale] : dictionaries[defaultLocale];
}
