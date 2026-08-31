import type { Locale } from "@/lib/i18n";

/**
 * The shop navigation, as profildesigntrading.dk publishes it.
 *
 * Taken from their megamenu: five top-level groups with their real category ids,
 * plus Shop EL Teknik, which appears in the header on some pages. The ids are
 * kept because they are the stable handle on their side — if their catalogue is
 * ever imported, this is the join key.
 *
 * Danish is the source; English is a translation of it. Their site is Danish
 * only, so nothing here was copied from an English original — these are ordinary
 * garment words, translated so the /en front is actually in English rather than
 * English chrome around a Danish menu.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠ THE `ours` MAPPING IS PROVISIONAL AND NEEDS PDT'S SIGN-OFF.
 *
 * Their groups and our `products.category` values are two different vocabularies.
 * Some pairs are unambiguous — Skjorter is Skjorter, Synlighed is High Vis
 * Arbejdstøj — and some are genuinely not: "Jakker" and "Tilbehør" each exist
 * under BOTH Profiltøj and Arbejdstøj on their site, and nothing in the data says
 * which one a given jacket belongs to.
 *
 * The rule applied here: map only where the pairing is defensible on its own,
 * and let everything else fall into `UNGROUPED` — which the menu shows as a real
 * group ("Øvrige") rather than hiding. A category filed under the wrong heading
 * is worse than one filed under none, because nobody goes looking for it.
 *
 * Today the whole catalogue is F&H/You corporate wear, which is why Profiltøj
 * carries almost all of it and Arbejdstøj, Fodtøj and Reklame artikler carry
 * nothing. That is a feed gap, not a mapping error — see Backlog.md P1.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** A label that exists in both languages. */
export type Label = Record<Locale, string>;

export function label(value: Label, locale: Locale): string {
  return value[locale] ?? value.da;
}

export type NavGroup = {
  /** Their category id, kept as the join key for a future import. */
  id: number;
  label: Label;
  /** URL segment on our site. Language-independent, like the ids. */
  slug: string;
  /** Their sub-categories, for the dropdown. */
  children: Label[];
  /**
   * Which of OUR `products.category` values this group covers.
   * Empty means: we carry nothing in this group yet.
   */
  ours: string[];
};

const l = (da: string, en: string): Label => ({ da, en });

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 3,
    label: l("Profiltøj", "Corporate wear"),
    slug: "profiltoej",
    children: [
      l("Skjorter", "Shirts"),
      l("Jakker", "Jackets"),
      l("T-shirt & Polo", "T-shirts & polos"),
      l("Bukser", "Trousers"),
      l("Strik", "Knitwear"),
      l("Fleece", "Fleece"),
      l("Sweatshirt", "Sweatshirts"),
      l("Blazer", "Blazers"),
      l("Veste", "Bodywarmers"),
      l("Sportstøj", "Sportswear"),
      l("Tilbehør", "Accessories"),
    ],
    ours: [
      "Skjorter", "Jakker", "T-shirts", "Poloshirts", "Fleece",
      "Sweatshirts", "Træningstøj", "Tilbehør", "Huer & caps",
    ],
  },
  {
    id: 5,
    label: l("Arbejdstøj", "Workwear"),
    slug: "arbejdstoej",
    children: [
      l("Jakker", "Jackets"),
      l("Veste", "Bodywarmers"),
      l("T-shirt", "T-shirts"),
      l("Polo", "Polos"),
      l("Trøjer", "Jumpers"),
      l("Skjorter", "Shirts"),
      l("Bukser", "Trousers"),
      l("Shorts", "Shorts"),
      l("Knickers", "Knickers"),
      l("Overalls", "Overalls"),
      l("Kedeldragt", "Boiler suits"),
      l("Regntøj", "Rainwear"),
      l("High Vis Arbejdstøj", "High-vis workwear"),
      l("Tilbehør", "Accessories"),
      l("Værnemidler", "Protective equipment"),
    ],
    /*
     * "Synlighed" is the You feed's word for high-visibility; "Arbejdstøj" is
     * the category Fristads publishes under its own name. The second one only
     * appeared once the Fristads importer ran — a mapping gap is invisible until
     * a feed introduces the value.
     */
    ours: ["Synlighed", "Arbejdstøj"],
  },
  {
    id: 7,
    label: l("Fodtøj", "Footwear"),
    slug: "fodtoej",
    children: [
      l("Sikkerhedssko", "Safety shoes"),
      l("Jobsko", "Occupational shoes"),
      l("Indlægssål", "Insoles"),
      l("Strømper", "Socks"),
      l("Gummistøvler", "Wellingtons"),
      l("Træsko", "Clogs"),
    ],
    ours: [],
  },
  {
    id: 4,
    label: l("Firmagaver", "Business gifts"),
    slug: "firmagaver",
    children: [
      l("Gaver", "Gifts"),
      // Price points, so the number carries across untouched.
      l("Gave 200", "Gift 200"),
      l("Gave 300", "Gift 300"),
      l("Gave 400", "Gift 400"),
      l("Gave 560", "Gift 560"),
      l("Gave 640", "Gift 640"),
      l("Gave 800", "Gift 800"),
      l("Gave 1040", "Gift 1040"),
    ],
    ours: ["Gaveartikler", "Rejseeffekter"],
  },
  {
    id: 6,
    label: l("Reklame artikler", "Promotional items"),
    slug: "reklameartikler",
    children: [],
    ours: [],
  },
  {
    id: 76,
    // A shop name, not a description — it stays as it is printed.
    label: l("Shop EL Teknik", "Shop EL Teknik"),
    slug: "el-teknik",
    children: [],
    ours: [],
  },
];

/**
 * Ours that no group claims — shown as its own menu entry.
 *
 * `Hospitality` could be Profiltøj or Arbejdstøj depending on whether a chef's
 * jacket counts as workwear; `Mulepose` is a tote, which is a Firmagave or a
 * Reklame artikel; `Diverse` is the feed's own catch-all. None of the three is
 * a judgement worth making on PDT's behalf.
 */
export const UNGROUPED_LABEL: Label = l("Øvrige", "Other");
export const UNGROUPED_SLUG = "oevrige";

const CLAIMED = new Set(NAV_GROUPS.flatMap((g) => g.ours));

export function ungroupedCategories(all: string[]): string[] {
  return all.filter((category) => !CLAIMED.has(category));
}

export function groupBySlug(slug: string): NavGroup | undefined {
  return NAV_GROUPS.find((g) => g.slug === slug);
}
