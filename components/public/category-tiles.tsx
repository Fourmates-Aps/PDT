import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { PublicCategory } from "@/lib/db/queries/public-catalogue";
import { ProductImage } from "@/components/shop/product-image";
import { Section, SectionHead } from "@/components/landing/section";
import { categoryHref } from "@/lib/public-routes";

/**
 * The category grid.
 *
 * The live site's equivalent cards each carry a paragraph of sales copy. Ours
 * carry a count instead: nobody has written that copy for these categories, and
 * writing it here would be inventing product positioning inside a component.
 * The count is true, useful, and comes from the same query that fills the tile.
 */
export function CategoryTiles({
  categories,
  dict,
  locale,
}: {
  categories: PublicCategory[];
  dict: Dictionary;
  locale: Locale;
}) {
  const t = dict.public.categories;

  if (categories.length === 0) return null;

  return (
    <Section id="range">
      <SectionHead eyebrow={t.eyebrow} title={t.title} lead={t.lead} />

      <ul className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <li key={category.name}>
            <Link
              href={categoryHref(locale, category.name)}
              className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-ink-300"
            >
              {/*
                * `cover`, not `contain` — deliberately different from the product
                * card below it.
                *
                * Supplier images are cutouts on pure white. Contained in a
                * 4:3 box on a bone background they read as an empty tile, because
                * the only thing visible is white margin. Cropping to fill throws
                * the margin away and leaves the garment, which is what a category
                * tile is for. The product card still contains, because there the
                * whole garment has to be visible.
                */}
              <div className="aspect-[4/3] overflow-hidden bg-bone-100">
                <ProductImage
                  src={category.image}
                  alt={category.name}
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-[15px] font-semibold text-ink-900">
                    {category.name}
                  </h3>
                  <p className="tabular mt-0.5 text-xs text-ink-500">
                    {t.count.replace("{n}", String(category.products))}
                  </p>
                </div>
                <ArrowRight
                  className="size-4 shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-900"
                  aria-hidden="true"
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8">
        <Link
          href={`/${locale}/katalog`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900 transition-colors hover:text-highvis-700"
        >
          {t.all}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </p>
    </Section>
  );
}
