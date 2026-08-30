import Link from "next/link";
import type { Dictionary, Locale } from "@/lib/i18n";
import type {
  PublicCategory,
  PublicProduct,
} from "@/lib/db/queries/public-catalogue";
import { Container } from "@/components/landing/section";
import { PublicProductCard } from "./product-card";
import { categoryHref } from "@/lib/public-routes";

/**
 * The range, filtered or not.
 *
 * Shared by /katalog and /katalog/[category] because they are the same page with
 * a different WHERE clause — splitting them into two layouts would guarantee
 * they drift apart the first time either one is touched.
 *
 * Faceted filtering by size, colour, fit and price is P1 in Backlog.md, not this
 * pass. What is here is the honest minimum: every category, one active at a
 * time, and a search that says how many it found.
 */
export function CatalogueList({
  products,
  categories,
  activeCategory,
  query,
  dict,
  locale,
}: {
  products: PublicProduct[];
  categories: PublicCategory[];
  activeCategory?: string;
  query?: string;
  dict: Dictionary;
  locale: Locale;
}) {
  const t = dict.public.catalogue;

  const title = query
    ? t.searchTitle.replace("{q}", query)
    : (activeCategory ?? t.title);

  return (
    <div className="py-10 md:py-14">
      <Container>
        <header className="max-w-[52ch]">
          <h1 className="text-h2 font-display font-semibold text-balance text-ink-900">
            {title}
          </h1>
          <p className="tabular mt-2 text-sm text-ink-500">
            {t.resultCount.replace("{n}", String(products.length))}
            {activeCategory || query ? null : ` · ${t.lead}`}
          </p>
        </header>

        {/* Categories as links rather than a <select>: they are navigation, they
            should be crawlable, and they must work without JavaScript. */}
        <nav className="mt-7 -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <ul className="flex w-max items-center gap-2 sm:w-auto sm:flex-wrap">
            <li>
              <Link
                href={`/${locale}/katalog`}
                aria-current={!activeCategory && !query ? "page" : undefined}
                className={`inline-block whitespace-nowrap rounded-sm border px-3 py-1.5 text-sm transition-colors ${
                  !activeCategory && !query
                    ? "border-ink-900 bg-ink-900 font-semibold text-bone-50"
                    : "border-bone-300 text-ink-700 hover:border-ink-900 hover:text-ink-900"
                }`}
              >
                {t.allCategories}
              </Link>
            </li>
            {categories.map((category) => {
              const active = category.name === activeCategory;
              return (
                <li key={category.name}>
                  <Link
                    href={categoryHref(locale, category.name)}
                    aria-current={active ? "page" : undefined}
                    className={`inline-block whitespace-nowrap rounded-sm border px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "border-ink-900 bg-ink-900 font-semibold text-bone-50"
                        : "border-bone-300 text-ink-700 hover:border-ink-900 hover:text-ink-900"
                    }`}
                  >
                    {category.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {products.length === 0 ? (
          <div className="mt-10 rounded-lg border border-border bg-card px-5 py-10 text-center">
            <p className="font-semibold text-ink-900">{t.empty}</p>
            <p className="mt-1 text-sm text-ink-500">{t.emptyHint}</p>
            <p className="mt-5">
              <Link
                href={`/${locale}/katalog`}
                className="text-sm font-semibold text-highvis-700 hover:text-highvis-800"
              >
                {t.back}
              </Link>
            </p>
          </div>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <li key={product.id}>
                <PublicProductCard
                  product={product}
                  dict={dict}
                  locale={locale}
                />
              </li>
            ))}
          </ul>
        )}
      </Container>
    </div>
  );
}
