import type { Locale } from "@/lib/i18n";

/**
 * English names for the category values that arrive from the supplier feed.
 *
 * `products.category` is a single free-text Danish column — there is no
 * `category_en`, so on the English front every dropdown, tile and chip read in
 * Danish while the chrome around them was English.
 *
 * This is a DISPLAY lookup only. The Danish value stays the key everywhere it
 * matters: in the database, in the URL (`/en/katalog/Skjorter`) and in every
 * query. Nothing here changes what a category IS, so a wrong or missing entry
 * costs a word on screen and nothing else.
 *
 * Unknown values fall through to the Danish original rather than to a blank or a
 * key — a new feed category shows up untranslated, which is obvious and
 * harmless, instead of disappearing.
 *
 * TODO(catalogue): when categories become real rows — which the feed pipeline in
 * Backlog.md P1 needs anyway — this belongs in a column next to the Danish name,
 * where PDT can edit it without a deploy.
 */
const ENGLISH: Record<string, string> = {
  "Huer & caps": "Hats & caps",
  Poloshirts: "Polo shirts",
  "T-shirts": "T-shirts",
  Fleece: "Fleece",
  Gaveartikler: "Gift items",
  Hospitality: "Hospitality",
  Jakker: "Jackets",
  Mulepose: "Tote bags",
  Rejseeffekter: "Travel items",
  Skjorter: "Shirts",
  Sweatshirts: "Sweatshirts",
  Synlighed: "High-visibility",
  Træningstøj: "Sportswear",
  Tilbehør: "Accessories",
  Diverse: "Miscellaneous",
};

export function categoryLabel(locale: Locale, category: string): string {
  if (locale === "da") return category;
  return ENGLISH[category] ?? category;
}
