import Link from "next/link";
import { Search, ShoppingBag, User } from "lucide-react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { Container } from "@/components/landing/section";
import { BrandLogo } from "./brand-logo";
import { categoryHref } from "@/lib/public-routes";
import { MenuDismiss } from "./menu-dismiss";
import { LocaleSwitch } from "./locale-switch";
import {
  NAV_GROUPS,
  UNGROUPED_LABEL,
  UNGROUPED_SLUG,
  label,
  ungroupedCategories,
} from "@/lib/content/navigation";
import { categoryLabel } from "@/lib/content/categories";

/**
 * One name for every menu in the header, so the browser keeps at most one open.
 * See the note on StoreHeader.
 */
const MENU_GROUP = "pdt-header-menu";

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
 * The storefront header, arranged as profildesigntrading.dk arranges it.
 *
 * Their layout, which this now follows: logo left, search across the middle, an
 * icon cluster on the right with a label under each icon, and the shop's
 * top-level groups on a second row with dropdowns.
 *
 * Their palette is NOT followed. D-7 keeps the ink/bone/high-vis identity and
 * defines "match the look and feel" as structure and behaviour — so this is
 * their arrangement in our colours, deliberately.
 *
 * Still no JavaScript for the core behaviour: the dropdowns are <details>
 * elements, so they open by keyboard and work with scripting off. That matters
 * more here than anywhere else in the app, because this is the surface strangers
 * and crawlers meet first.
 *
 * They share a `name`, which makes them an EXCLUSIVE ACCORDION: opening one
 * closes any other. Without it every menu is independent, so two panels sit open
 * on top of each other — which is exactly what happened. This is plain HTML, not
 * script; a browser too old to know the attribute simply falls back to the old
 * behaviour rather than breaking.
 *
 * Escape and click-outside are a progressive enhancement layered on top by
 * <MenuDismiss>, because <details> does not do either on its own. An earlier
 * version of this comment claimed it did. It does not.
 *
 * FAVORITTER IS DELIBERATELY ABSENT. Their cluster has four icons; this has
 * three. A wishlist is P3 in Backlog.md and does not exist, so the heart would
 * send a visitor to the login and then to nothing. A gap in the row is better
 * than an icon promising a feature we do not have.
 */
export function StoreHeader({
  dict,
  locale,
  categories,
}: {
  dict: Dictionary;
  locale: Locale;
  /** Every category with stock, so the menus can only offer what is real. */
  categories: string[];
}) {
  const t = dict.public.header;
  const base = `/${locale}`;

  const stocked = new Set(categories);
  const leftovers = ungroupedCategories(categories);

  return (
    <header className="border-b border-bone-200 bg-bone-50/95 backdrop-blur-sm md:sticky md:top-0 md:z-50">
      <MenuDismiss name={MENU_GROUP} />
      <Container className="flex flex-wrap items-center gap-x-4 gap-y-2.5 py-3 sm:gap-x-6 md:h-[76px] md:flex-nowrap md:py-0">
        <Link href={base} className="shrink-0" aria-label="Profil Design Trading">
          <BrandLogo tone="ink" className="h-9 w-auto sm:h-10" />
        </Link>

        {/* A GET form: the query ends up in the URL, so a search is shareable and
            the back button behaves. Wraps to its own line on a phone rather than
            disappearing. */}
        <form
          action={`${base}/katalog`}
          method="get"
          role="search"
          className="order-last flex w-full min-w-0 items-center md:order-none md:mx-auto md:w-auto md:max-w-[440px] md:flex-1"
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

        {/* The icon cluster: icon over label, as theirs is. */}
        <nav className="ml-auto flex shrink-0 items-start gap-5 sm:gap-6">
          <details name={MENU_GROUP} className="group relative">
            <summary className="flex cursor-pointer list-none flex-col items-center gap-1 text-ink-500 transition-colors hover:text-ink-900 [&::-webkit-details-marker]:hidden">
              <span
                className="flex h-5 flex-col justify-center gap-[3px]"
                aria-hidden="true"
              >
                <span className="block h-[2px] w-5 bg-current" />
                <span className="block h-[2px] w-5 bg-current" />
                <span className="block h-[2px] w-5 bg-current" />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">
                {t.info}
              </span>
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
            href={`${base}/login`}
            className="flex flex-col items-center gap-1 text-ink-500 transition-colors hover:text-ink-900"
          >
            <User className="size-5" aria-hidden="true" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">
              {t.account}
            </span>
          </Link>

          {/* An anonymous visitor is sent to the login, which is what their site
              does too — the basket lives behind the customer's agreement. */}
          <Link
            href={`${base}/cart`}
            className="flex flex-col items-center gap-1 text-ink-500 transition-colors hover:text-ink-900"
          >
            <ShoppingBag className="size-5" aria-hidden="true" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">
              {t.cart}
            </span>
          </Link>

          <LocaleSwitch
            current={locale}
            label={dict.meta.language}
            className="self-center"
          />
        </nav>
      </Container>

      {/* The group row. Scrolls sideways on a phone rather than wrapping to
          three lines and pushing the page down. */}
      <div className="border-t border-bone-200 bg-bone-50">
        <Container className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:overflow-visible sm:px-8">
          <ul className="flex w-max items-center gap-6 py-2.5 sm:w-auto sm:flex-wrap">
            {NAV_GROUPS.map((group) => {
              const mine = group.ours.filter((c) => stocked.has(c));
              const groupLabel = label(group.label, locale);
              return (
                <li key={group.slug} className="relative">
                  <details name={MENU_GROUP} className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-1 whitespace-nowrap font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-800 transition-colors hover:text-highvis-700 [&::-webkit-details-marker]:hidden">
                      {groupLabel}
                      <span
                        className="text-[9px] text-ink-400 transition-transform group-open:rotate-180"
                        aria-hidden="true"
                      >
                        ▾
                      </span>
                    </summary>

                    <div className="absolute left-0 z-50 mt-2 w-64 rounded-md border border-bone-200 bg-bone-50 py-2 shadow-lg">
                      <Link
                        href={`${base}/katalog/gruppe/${group.slug}`}
                        className="block px-4 py-2 text-sm font-semibold text-ink-900 transition-colors hover:bg-bone-100"
                      >
                        {t.allIn.replace("{group}", groupLabel)}
                      </Link>

                      {mine.length > 0 ? (
                        <ul className="mt-1 border-t border-bone-200 pt-1">
                          {mine.map((category) => (
                            <li key={category}>
                              <Link
                                href={categoryHref(locale, category)}
                                className="block px-4 py-2 text-sm text-ink-700 transition-colors hover:bg-bone-100 hover:text-ink-900"
                              >
                                {categoryLabel(locale, category)}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        /* Nothing stocked, so their own sub-categories are shown
                           as plain text: the menu still says what the group
                           covers without offering links that go nowhere. */
                        <div className="mt-1 border-t border-bone-200 px-4 pt-2 pb-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-warning">
                            {t.notStocked}
                          </p>
                          {group.children.length > 0 ? (
                            <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
                              {group.children
                                .map((child) => label(child, locale))
                                .join(" · ")}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}

            {leftovers.length > 0 ? (
              <li>
                <Link
                  href={`${base}/katalog/gruppe/${UNGROUPED_SLUG}`}
                  className="whitespace-nowrap font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500 transition-colors hover:text-ink-900"
                >
                  {label(UNGROUPED_LABEL, locale)}
                </Link>
              </li>
            ) : null}

            <li>
              <Link
                href={`${base}/katalog`}
                className="whitespace-nowrap text-sm text-ink-500 transition-colors hover:text-ink-900"
              >
                {dict.public.catalogue.allCategories}
              </Link>
            </li>
          </ul>
        </Container>
      </div>
    </header>
  );
}
