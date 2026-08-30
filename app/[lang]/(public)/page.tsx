import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getDictionary, getLocale } from "@/lib/i18n";
import {
  listPublicCategories,
  listPublicProducts,
} from "@/lib/db/queries/public-catalogue";
import { Esg } from "@/components/landing/esg";
import { Contact } from "@/components/landing/contact";
import { Section, SectionHead } from "@/components/landing/section";
import { Hero } from "@/components/public/hero";
import { Welcome } from "@/components/public/welcome";
import { StepsStrip } from "@/components/public/steps-strip";
import { Promises } from "@/components/public/promises";
import { CategoryTiles } from "@/components/public/category-tiles";
import { PublicProductCard } from "@/components/public/product-card";

/**
 * The front page.
 *
 * Section for section, this is profildesigntrading.dk's homepage — hero,
 * welcome, the three steps, green responsibility, the range, products, the
 * callback form, the promises, the footer — rendered in PDT's own design system
 * rather than the live site's charcoal and Barlow. That split is D-7: "match the
 * look and feel" was decided to mean the structure and the behaviour, not the
 * visual identity.
 *
 * The one behaviour that is not cosmetic: the product grid shows no prices, the
 * same as the live site. See lib/db/queries/public-catalogue.ts.
 */
/**
 * Rebuilt hourly rather than on every request or only at deploy.
 *
 * Nothing here reads cookies or headers, so Next would otherwise bake the
 * product grid into the build and a newly imported product would not appear
 * until the next deploy. Supplier feeds land in nightly batches, so an hour is
 * far finer-grained than the data underneath it.
 */
export const revalidate = 3600;

export default async function PublicFrontPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  const [categories, products] = await Promise.all([
    listPublicCategories(6),
    listPublicProducts({ limit: 8 }),
  ]);

  const t = dict.public.products;

  return (
    <>
      <Hero dict={dict} locale={locale} />
      <Welcome dict={dict} />
      <StepsStrip dict={dict} />
      <Esg dict={dict} />
      <CategoryTiles categories={categories} dict={dict} locale={locale} />

      {products.length > 0 ? (
        <Section tone="surface">
          <SectionHead eyebrow={t.eyebrow} title={t.title} lead={t.lead} />

          <ul className="mt-9 grid grid-cols-2 gap-4 lg:grid-cols-4">
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

          <p className="mt-8">
            <Link
              href={`/${locale}/katalog`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900 transition-colors hover:text-highvis-700"
            >
              {t.viewAll}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </p>
        </Section>
      ) : null}

      <Contact dict={dict} locale={locale} />
      <Promises dict={dict} />
    </>
  );
}
