import Link from "next/link";
import { Search } from "lucide-react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { otherLocale } from "@/lib/i18n";
import { Container } from "@/components/landing/section";
import { BrandLogo } from "./brand-logo";
import { categoryHref } from "@/lib/public-routes";

/** The live site's Info menu, in its order. */
const INFO_LINKS: { href: string; label: (d: Dictionary) => string }[] = [
  { href: "/om-os", label: (d) => d.public.about.title },
  { href: "/kontakt", label: (d) => d.public.contact.title },
  { href: "/handelsbetingelser", label: () => "Handelsbetingelser" },
  { href: "/webshop", label: (d) => d.public.webshop.title },
  { href: "/kataloger", label: (d) => d.public.catalogues.title },
  { href: "/brands", label: (d) => d.public.brands.title },
  { href: "/stoerrelsesguide", label: (d) => d.public.sizeGuide.title },
];

/**
 * The storefront header.
 *
 * Everything is a link or a plain GET form, so this stays a Server Component and
 * the whole public front works with JavaScript off — which matters more here than
 * anywhere else in the app, because this is the surface strangers and crawlers
 * meet first.
 *
 * The category row REPLACES the live site's five fixed groups (Profiltøj ·
 * Arbejdstøj · Fodtøj · Firmagaver · Reklame artikler). No feed or document we
 * hold maps those groups onto `products.category`, so the nav is built from the
 * categories that actually have products in them. Swap it the moment the real
 * grouping is known — see listPublicCategories.
 */
export function StoreHeader({
  dict,
  locale,
  categories,
}: {
  dict: Dictionary;
  locale: Locale;
  /** Category names, already ordered by size. */
  categories: string[];
}) {
  const t = dict.public.header;
  const other = otherLocale(locale);
  const base = `/${locale}`;

  return (
    // Sticky from md up only. On a phone the three rows come to 154px — a fifth
    // of the viewport — and pinning that much chrome to the top costs more than
    // the convenience of a search box that follows you down the page.
    <header className="border-b border-bone-200 bg-bone-50/95 backdrop-blur-sm md:sticky md:top-0 md:z-50">
      {/* Wraps rather than hides: on a phone the search moves to its own line
          under the logo instead of disappearing, because a shop whose only
          search box is desktop-only is a shop most visitors cannot search. */}
      <Container className="flex flex-wrap items-center gap-x-4 gap-y-2.5 py-3 sm:gap-x-6 md:h-16 md:flex-nowrap md:py-0">
        <Link href={base} className="shrink-0" aria-label="Profil Design Trading">
          {/* "Be your brand" is inside the artwork — it is not a separate line
              of markup any more. */}
          <BrandLogo tone="ink" className="h-9 w-auto sm:h-10" />
        </Link>

        {/* A GET form: the query ends up in the URL, so a search is shareable
            and the back button behaves. */}
        <form
          action={`${base}/katalog`}
          method="get"
          role="search"
          className="order-last flex w-full min-w-0 items-center md:order-none md:ml-auto md:w-auto md:max-w-[420px] md:flex-1"
        >
          <label className="sr-only" htmlFor="site-search">
            {t.searchLabel}
          </label>
          <div className="flex min-w-0 flex-1 items-center rounded-md border border-bone-300 bg-white transition-colors focus-within:border-ink-900">
            <input
              id="site-search"
              type="search"
              name="q"
              placeholder={t.searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent px-3.5 py-2 text-sm text-ink-800 placeholder:text-ink-300 focus:outline-none"
            />
            <button
              type="submit"
              className="px-3 py-2 text-ink-500 transition-colors hover:text-ink-900"
              aria-label={t.search}
            >
              <Search className="size-4" aria-hidden="true" />
            </button>
          </div>
        </form>

        <nav className="ml-auto flex shrink-0 items-center gap-5">
          {/*
            * The live site's "Info" menu. A <details> element rather than a
            * scripted dropdown, so it opens with the keyboard, closes with Esc
            * and works with JavaScript off — the whole point of this surface.
            */}
          <details className="group relative hidden sm:block">
            <summary className="cursor-pointer list-none text-sm text-ink-500 transition-colors hover:text-ink-900 [&::-webkit-details-marker]:hidden">
              {t.info}
            </summary>
            <ul className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-bone-200 bg-bone-50 py-2 shadow-lg">
              {INFO_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={`${base}${item.href}`}
                    className="block px-4 py-2 text-sm text-ink-700 transition-colors hover:bg-bone-100 hover:text-ink-900"
                  >
                    {item.label(dict)}
                  </Link>
                </li>
              ))}
            </ul>
          </details>

          <Link
            href={`${base}/om-os`}
            className="hidden text-sm text-ink-500 transition-colors hover:text-ink-900 lg:block"
          >
            {t.about}
          </Link>
          <Link
            href={`/${other}`}
            hrefLang={other}
            aria-label={dict.meta.switchToAria}
            className="hidden text-sm text-ink-500 transition-colors hover:text-ink-900 lg:block"
          >
            {dict.meta.switchTo}
          </Link>
          <Link
            href={`${base}/login`}
            className="rounded-md bg-ink-900 px-4 py-2 text-sm font-semibold text-bone-50 transition-colors hover:bg-ink-700"
          >
            {dict.public.utility.login}
          </Link>
        </nav>
      </Container>

      {/* Category row. Scrolls sideways on a phone rather than wrapping to three
          lines and pushing the page down. */}
      <div className="border-t border-bone-200 bg-bone-50">
        <Container className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:overflow-visible sm:px-8">
          <ul className="flex w-max items-center gap-5 py-2.5 sm:w-auto sm:flex-wrap">
            <li>
              <Link
                href={`${base}/katalog`}
                className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-900 transition-colors hover:text-highvis-700"
              >
                {t.catalogue}
              </Link>
            </li>
            {categories.map((category) => (
              <li key={category}>
                <Link
                  href={categoryHref(locale, category)}
                  className="whitespace-nowrap text-sm text-ink-500 transition-colors hover:text-ink-900"
                >
                  {category}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </div>
    </header>
  );
}
