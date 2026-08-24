import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getSessionUser } from "@/lib/supabase/server";
import {
  getAllowanceSummary,
  getMember,
  getShopProduct,
  listLastOrderedSizes,
} from "@/lib/db/queries/shop";
import { ProductImage } from "@/components/shop/product-image";
import { VariantPicker } from "@/components/shop/variant-picker";
import { EmptyState } from "@/components/dashboard/primitives";
import { formatDate } from "@/lib/format";
import { parseMeasurements, recommendSize } from "@/lib/shop/sizing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const [user, { slug }] = await Promise.all([getSessionUser(), params]);
  const result = user?.organisationId
    ? await getShopProduct(user.organisationId, slug)
    : null;

  return {
    title: result
      ? `${result.product.name} — Profil Design Trading`
      : "Profil Design Trading",
    robots: { index: false, follow: false },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [dict, locale, user, { slug }] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSessionUser(),
    params,
  ]);

  const t = dict.shop.product;
  const organisationId = user?.organisationId;

  if (!organisationId) {
    return <EmptyState>{dict.shop.grid.noOrg}</EmptyState>;
  }

  // Scoped to the organisation's assortment, so a product another customer can
  // buy is a 404 here rather than a browsable page with no price.
  const result = await getShopProduct(organisationId, slug);
  if (!result) notFound();

  const { product, variants } = result;
  const priced = variants.filter((v) => v.priceDkk !== null);
  const stockUpdated = variants.find((v) => v.stockUpdatedAt)?.stockUpdatedAt;

  const member = await getMember(user.id, organisationId);
  const [allowance, lastSizes] = await Promise.all([
    getAllowanceSummary(organisationId, member?.id ?? null),
    member
      ? listLastOrderedSizes(organisationId, member.id)
      : new Map<string, string>(),
  ]);

  // Size history first, measurements second — see lib/shop/sizing.ts.
  const recommended = recommendSize({
    lastOrderedSize: lastSizes.get(product.id),
    measurements: parseMeasurements(member?.measurements),
    available: [
      ...new Set(
        priced
          .filter((v) => v.stockQty > 0 && v.size)
          .map((v) => v.size as string),
      ),
    ],
  });

  const trust = t.trust;

  return (
    <>
      <Link
        href={`/${locale}/shop`}
        className="text-sm text-ink-500 transition-colors hover:text-ink-900"
      >
        {t.back}
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="overflow-hidden rounded-lg border border-border bg-bone-100">
          <ProductImage
            src={product.primaryImage}
            alt={product.name}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="aspect-4/5 size-full object-contain"
          />
        </div>

        <div className="min-w-0">
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-highvis-700">
            {product.brand}
          </p>
          <h1 className="mt-2 text-h2 font-display font-semibold text-ink-900">
            {product.name}
          </h1>
          <p className="mt-1 text-sm text-ink-500">{product.category}</p>

          {priced.length === 0 ? (
            <p className="mt-6 rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-ink-800">
              {t.notFound}
            </p>
          ) : (
            <VariantPicker
              variants={priced.map((v) => ({
                id: v.id,
                colourName: v.colourName,
                colourHex: v.colourHex,
                size: v.size,
                stockQty: v.stockQty,
                priceDkk: v.priceDkk,
              }))}
              dict={t}
              logoDict={dict.shop.logo}
              locale={locale}
              displayMode={allowance.displayMode}
              pointsLabel={dict.shop.allowance.points}
              recommended={recommended}
              sizeGuideHref={`/${locale}/size-guide`}
            />
          )}

          <ul className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              [trust.deliveryTitle, trust.deliveryBody],
              [trust.returnTitle, trust.returnBody],
              [trust.payTitle, trust.payBody],
            ].map(([title, body]) => (
              <li
                key={title}
                className="rounded-md border border-border bg-card px-3 py-2.5"
              >
                <p className="text-sm font-semibold text-ink-900">{title}</p>
                <p className="mt-0.5 text-xs text-ink-500">{body}</p>
              </li>
            ))}
          </ul>

          <dl className="mt-8 divide-y divide-border border-t border-border">
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-sm text-ink-500">{t.co2Title}</dt>
              <dd className="tabular text-sm font-semibold text-ink-900">
                {/* Absent CO2 is stated, never shown as zero — coverage in the
                    supplier feed is partial and a 0 would read as "no impact". */}
                {product.co2Available && product.co2Kg
                  ? `${Number(product.co2Kg).toFixed(1).replace(".", ",")} kg CO₂e`
                  : <span className="font-normal text-ink-500">{t.co2Missing}</span>}
              </dd>
            </div>
            {stockUpdated ? (
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-sm text-ink-500">{t.stockNote}</dt>
                <dd className="tabular text-sm text-ink-800">
                  {formatDate(locale, stockUpdated)}
                </dd>
              </div>
            ) : null}
          </dl>

          <p className="mt-4 text-xs leading-relaxed text-ink-500">
            {t.stockBatchNote}
          </p>
        </div>
      </div>
    </>
  );
}
