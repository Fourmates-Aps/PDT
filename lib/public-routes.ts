import type { Locale } from "@/lib/i18n";

/**
 * URLs for the public front.
 *
 * Category names are the routing key rather than a slug column, because there is
 * no category table — `products.category` is a free-text value that arrives from
 * the supplier feed ("Huer & caps", "Træningstøj"). Encoding it keeps `&` and the
 * Danish letters out of trouble in a path segment, and decoding it back is exact,
 * so a renamed category cannot silently point at nothing.
 *
 * TODO(catalogue): when categories become real rows with slugs — which the feed
 * pipeline in Backlog.md P1 will need anyway — swap these two functions and every
 * caller follows.
 */
export function categoryHref(locale: Locale, category: string): string {
  return `/${locale}/katalog/${encodeURIComponent(category)}`;
}

export function decodeCategory(segment: string): string {
  return decodeURIComponent(segment);
}

export function productHref(locale: Locale, slug: string): string {
  return `/${locale}/produkt/${slug}`;
}
