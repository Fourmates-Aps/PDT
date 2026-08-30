import "server-only";
import type { Metadata } from "next";
import { getDictionary, type Dictionary } from "@/lib/i18n";

/**
 * Title + robots for a signed-in page.
 *
 * Without this every dashboard route inherits the marketing title from the root
 * layout, so each browser tab reads "Firmatøj med jeres logo" — useless when a
 * customer admin has several tabs open.
 */
export async function pageMetadata(
  pick: (dict: Dictionary) => string,
): Promise<Metadata> {
  const dict = await getDictionary();
  return {
    title: `${pick(dict)} — Profil Design Trading`,
    // Nothing behind a login belongs in a search index.
    robots: { index: false, follow: false },
  };
}

/**
 * Title + description for a page on the public front.
 *
 * The opposite of the rule above: these pages exist to be found. Robots are left
 * alone so the root layout's default (indexable) applies — setting `index: true`
 * here would look like a decision when it is only the absence of one.
 */
export async function publicMetadata(
  build: (dict: Dictionary) => { title: string; description?: string },
): Promise<Metadata> {
  const dict = await getDictionary();
  const { title, description } = build(dict);
  return {
    title: `${title} — Profil Design Trading`,
    ...(description ? { description } : {}),
  };
}
