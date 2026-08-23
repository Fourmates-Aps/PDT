import Link from "next/link";
import { pageMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getSessionUser } from "@/lib/supabase/server";
import { listShopCategories, listShopProducts } from "@/lib/db/queries/shop";
import { ProductImage } from "@/components/shop/product-image";
import { PageHeader, EmptyState } from "@/components/dashboard/primitives";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";

export function generateMetadata() {
  return pageMetadata((d) => d.shop.grid.title);
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string }>;
}) {
  const [dict, locale, user, params] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSessionUser(),
    searchParams,
  ]);

  const t = dict.shop.grid;
  const organisationId = user?.organisationId;

  if (!organisationId) {
    return (
      <>
        <PageHeader title={t.title} lead={t.lead} />
        <EmptyState>{t.noOrg}</EmptyState>
      </>
    );
  }

  const active = params.kategori;
  const [categories, items] = await Promise.all([
    listShopCategories(organisationId),
    listShopProducts(organisationId, active),
  ]);

  const base = `/${locale}/shop`;

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      {/* Horizontally scrollable on phones rather than wrapping into four rows
          of chips that push the products below the fold. */}
      <div className="-mx-4 mb-8 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2">
          <Link
            href={base}
            className={`rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              !active
                ? "border-ink-900 bg-ink-900 text-bone-50"
                : "border-border text-ink-700 hover:border-ink-900"
            }`}
          >
            {t.all}
          </Link>
          {categories.map((c) => (
            <Link
              key={c.category}
              href={`${base}?kategori=${encodeURIComponent(c.category)}`}
              className={`rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                active === c.category
                  ? "border-ink-900 bg-ink-900 text-bone-50"
                  : "border-border text-ink-700 hover:border-ink-900"
              }`}
            >
              {c.category}
              <span className="tabular ml-1.5 text-xs opacity-60">{c.count}</span>
            </Link>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState>{t.empty}</EmptyState>
      ) : (
        <>
          <p className="tabular mb-4 text-sm text-ink-500">
            {items.length} {t.products}
          </p>
          <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
            {items.map((p) => {
              const out = p.stockQty <= 0;
              const low = !out && p.stockQty < 15;
              return (
                <li key={p.id}>
                  <Link
                    href={`${base}/${p.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-ink-300"
                  >
                    <div className="relative aspect-4/5 overflow-hidden bg-bone-100">
                      <ProductImage
                        src={p.primaryImage}
                        alt={p.name}
                        sizes="(max-width: 1024px) 50vw, 25vw"
                        className="size-full object-contain transition-transform duration-300 group-hover:scale-105"
                      />
                      {out || low ? (
                        <span className="absolute top-2 left-2">
                          <Badge variant={out ? "destructive" : "outline"}>
                            {out ? t.outOfStock : t.lowStock}
                          </Badge>
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-1 flex-col p-3 sm:p-4">
                      <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                        {p.brand}
                      </p>
                      <h2 className="mt-1 text-sm font-semibold text-ink-900 sm:text-[15px]">
                        {p.name}
                      </h2>
                      <p className="mt-0.5 text-xs text-ink-500">{p.category}</p>

                      <div className="mt-auto pt-3">
                        {p.fromPrice ? (
                          <p className="tabular text-[15px] font-bold text-ink-900">
                            <span className="text-xs font-normal text-ink-500">
                              {t.from}{" "}
                            </span>
                            {formatMoney(locale, p.fromPrice)}
                          </p>
                        ) : null}
                        {p.co2Available && p.co2Kg ? (
                          <p className="tabular mt-1 text-xs text-success">
                            {Number(p.co2Kg).toFixed(1).replace(".", ",")} kg CO₂e
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
