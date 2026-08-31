import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Leaf, Lock } from "lucide-react";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getPublicProduct } from "@/lib/db/queries/public-catalogue";
import { VariantExplorer } from "@/components/public/variant-explorer";
import { ProductGallery } from "@/components/public/product-gallery";
import { VariantSelectionProvider } from "@/components/public/variant-selection";
import { Container } from "@/components/landing/section";
import { categoryHref } from "@/lib/public-routes";
import { categoryLabel } from "@/lib/content/categories";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublicProduct(slug);
  if (!product) return { title: "Profil Design Trading" };

  return {
    title: `${product.name} — ${product.brand} — Profil Design Trading`,
    description: [product.brand, product.name, product.material]
      .filter(Boolean)
      .join(" · "),
  };
}

/**
 * A product page for someone who is not signed in.
 *
 * Everything the live site shows, and the same thing it withholds: colours,
 * sizes, material and the item number are here; the price and the quantity box
 * are not, replaced by the line the live site itself uses — "Du skal være logget
 * ind for at kunne lave bestillinger."
 *
 * That is not a paywall for its own sake. What a customer pays is set by their
 * company's agreement (org_pricing), so there is no single price to print; and
 * BR-39a makes at least one supplier's prices contractually confidential. See
 * lib/db/queries/public-catalogue.ts.
 */
export default async function PublicProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [dict, locale, { slug }] = await Promise.all([
    getDictionary(),
    getLocale(),
    params,
  ]);

  const product = await getPublicProduct(slug);
  if (!product) notFound();

  const t = dict.public.product;

  const facts = [
    { label: t.brand, value: product.brand },
    { label: t.category, value: categoryLabel(locale, product.category) },
    { label: t.material, value: product.material },
  ].filter((f) => f.value);

  return (
    <div className="py-10 md:py-14">
      <Container>
        <Link
          href={categoryHref(locale, product.category)}
          className="text-sm text-ink-500 transition-colors hover:text-ink-900"
        >
          {t.back}
        </Link>

        {/*
          The provider wraps BOTH columns so a colour click can reach the
          picture. Everything inside stays server-rendered — it arrives as
          children, not as serialised props.
        */}
        <VariantSelectionProvider>
        <div className="mt-5 grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
          <ProductGallery
            images={product.images}
            alt={product.name}
            variants={product.variants}
            labels={{
              view: t.viewImage,
              noColourPhoto: t.noColourPhoto,
            }}
          />

          <div>
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-highvis-700">
              {product.brand}
            </p>
            <h1 className="mt-2 text-h2 font-display font-semibold text-balance text-ink-900">
              {product.name}
            </h1>
            <p className="tabular mt-2 text-sm text-ink-500">
              {t.sku}: {product.supplierSku}
            </p>

            {/*
              Interactive, not decorative. These used to be <li> chips styled
              exactly like buttons and wired to nothing — see VariantExplorer.
            */}
            <VariantExplorer
              colours={product.colours}
              sizes={product.sizes}
              variants={product.variants}
              labels={{
                colours: t.colours,
                sizes: t.sizes,
                itemNo: t.itemNo,
                unavailable: t.variantUnavailable,
                clear: t.clearSelection,
              }}
            />

            {facts.length > 0 ? (
              <dl className="mt-7 divide-y divide-border border-y border-border text-sm">
                {facts.map((fact) => (
                  <div
                    key={fact.label}
                    className="flex justify-between gap-4 py-2.5"
                  >
                    <dt className="text-ink-500">{fact.label}</dt>
                    <dd className="text-right font-medium text-ink-800">
                      {fact.value}
                    </dd>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="flex items-center gap-1.5 text-ink-500">
                    <Leaf className="size-3.5" aria-hidden="true" />
                    {t.co2}
                  </dt>
                  {/* co2Available is explicit for exactly this line: no data is
                      not a footprint of zero. */}
                  <dd className="tabular text-right font-medium text-ink-800">
                    {product.co2Available && product.co2Kg
                      ? `${product.co2Kg} kg`
                      : t.co2Unavailable}
                  </dd>
                </div>
              </dl>
            ) : null}

            <section className="mt-8 rounded-lg border border-border bg-bone-100 p-5">
              <p className="flex items-center gap-2 font-semibold text-ink-900">
                <Lock className="size-4 shrink-0" aria-hidden="true" />
                {t.loginNotice}
              </p>
              <p className="mt-2 max-w-[52ch] text-sm text-ink-500">
                {t.loginBody}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  href={`/${locale}/login`}
                  className="rounded-md bg-ink-900 px-5 py-2.5 text-sm font-semibold text-bone-50 transition-colors hover:bg-ink-700"
                >
                  {dict.public.utility.login}
                </Link>
                <Link
                  href={`/${locale}/ansoeg`}
                  className="rounded-md border border-bone-300 px-5 py-2.5 text-sm font-semibold text-ink-800 transition-colors hover:border-ink-900"
                >
                  {dict.public.utility.apply}
                </Link>
              </div>
            </section>
          </div>
        </div>
        </VariantSelectionProvider>
      </Container>
    </div>
  );
}
