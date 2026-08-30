/**
 * The shop navigation, as profildesigntrading.dk publishes it.
 *
 * Taken from their megamenu: five top-level groups with their real category ids,
 * plus Shop EL Teknik, which appears in the header on some pages. The ids are
 * kept because they are the stable handle on their side — if their catalogue is
 * ever imported, this is the join key.
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

export type NavGroup = {
  /** Their category id, kept as the join key for a future import. */
  id: number;
  /** Their label, in Danish, as printed. */
  label: string;
  /** URL segment on our site. */
  slug: string;
  /** Their sub-categories, for the dropdown. */
  children: string[];
  /**
   * Which of OUR `products.category` values this group covers.
   * Empty means: we carry nothing in this group yet.
   */
  ours: string[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 3,
    label: "Profiltøj",
    slug: "profiltoej",
    children: [
      "Skjorter", "Jakker", "T-shirt & Polo", "Bukser", "Strik", "Fleece",
      "Sweatshirt", "Blazer", "Veste", "Sportstøj", "Tilbehør",
    ],
    ours: [
      "Skjorter", "Jakker", "T-shirts", "Poloshirts", "Fleece",
      "Sweatshirts", "Træningstøj", "Tilbehør", "Huer & caps",
    ],
  },
  {
    id: 5,
    label: "Arbejdstøj",
    slug: "arbejdstoej",
    children: [
      "Jakker", "Veste", "T-shirt", "Polo", "Trøjer", "Skjorter", "Bukser",
      "Shorts", "Knickers", "Overalls", "Kedeldragt", "Regntøj",
      "High Vis Arbejdstøj", "Tilbehør", "Værnemidler",
    ],
    // Synlighed is the You feed's word for high-visibility.
    ours: ["Synlighed"],
  },
  {
    id: 7,
    label: "Fodtøj",
    slug: "fodtoej",
    children: [
      "Sikkerhedssko", "Jobsko", "Indlægssål", "Strømper",
      "Gummistøvler", "Træsko",
    ],
    ours: [],
  },
  {
    id: 4,
    label: "Firmagaver",
    slug: "firmagaver",
    children: [
      "Gaver", "Gave 200", "Gave 300", "Gave 400",
      "Gave 560", "Gave 640", "Gave 800", "Gave 1040",
    ],
    ours: ["Gaveartikler", "Rejseeffekter"],
  },
  {
    id: 6,
    label: "Reklame artikler",
    slug: "reklameartikler",
    children: [],
    ours: [],
  },
  {
    id: 76,
    label: "Shop EL Teknik",
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
export const UNGROUPED_LABEL = "Øvrige";
export const UNGROUPED_SLUG = "oevrige";

const CLAIMED = new Set(NAV_GROUPS.flatMap((g) => g.ours));

export function ungroupedCategories(all: string[]): string[] {
  return all.filter((category) => !CLAIMED.has(category));
}

export function groupBySlug(slug: string): NavGroup | undefined {
  return NAV_GROUPS.find((g) => g.slug === slug);
}
