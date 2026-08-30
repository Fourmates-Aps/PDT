import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/lib/i18n";
import {
  listPublicCategories,
  listPublicProducts,
} from "@/lib/db/queries/public-catalogue";
import { CatalogueList } from "@/components/public/catalogue-list";
import { decodeCategory } from "@/lib/public-routes";
import { categoryLabel } from "@/lib/content/categories";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const [{ category }, locale] = await Promise.all([params, getLocale()]);
  const name = categoryLabel(locale, decodeCategory(category));
  return { title: `${name} — Profil Design Trading` };
}

/** One category of the range. */
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const [dict, locale, { category: raw }] = await Promise.all([
    getDictionary(),
    getLocale(),
    params,
  ]);

  const category = decodeCategory(raw);

  const [categories, products] = await Promise.all([
    listPublicCategories(20),
    listPublicProducts({ category, limit: 60 }),
  ]);

  // A category that is not in the list is a 404 rather than an empty grid: the
  // name comes from the URL, so anything else would render whatever a visitor
  // typed as a heading.
  if (!categories.some((c) => c.name === category)) notFound();

  return (
    <CatalogueList
      products={products}
      categories={categories}
      activeCategory={category}
      heading={categoryLabel(locale, category)}
      dict={dict}
      locale={locale}
    />
  );
}
