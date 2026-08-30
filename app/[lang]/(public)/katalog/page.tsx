import { publicMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import {
  listPublicCategories,
  listPublicProducts,
} from "@/lib/db/queries/public-catalogue";
import { CatalogueList } from "@/components/public/catalogue-list";

export function generateMetadata() {
  return publicMetadata((d) => ({
    title: d.public.catalogue.title,
    description: d.public.catalogue.lead,
  }));
}

/** The whole range, or a search across it. */
export default async function CataloguePage({
  searchParams,
}: {
  // Next 16: searchParams is a Promise.
  searchParams: Promise<{ q?: string }>;
}) {
  const [dict, locale, { q }] = await Promise.all([
    getDictionary(),
    getLocale(),
    searchParams,
  ]);

  const query = q?.trim() || undefined;

  const [categories, products] = await Promise.all([
    listPublicCategories(20),
    // 60 covers today's catalogue; pagination arrives with the real feed, which
    // is where the number stops being small enough to ignore.
    listPublicProducts({ query, limit: 60 }),
  ]);

  return (
    <CatalogueList
      products={products}
      categories={categories}
      query={query}
      dict={dict}
      locale={locale}
    />
  );
}
