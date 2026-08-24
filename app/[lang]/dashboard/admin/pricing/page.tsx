import Link from "next/link";
import { pageMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import {
  listCatalogueBrands,
  listCatalogueCategories,
  listPricingCustomers,
  listPricingRows,
  summarise,
} from "@/lib/db/queries/pricing";
import { marginTone } from "@/lib/pricing";
import { formatMoney, formatNumber } from "@/lib/format";
import {
  EmptyState,
  PageHeader,
  Stat,
  StatGrid,
} from "@/components/dashboard/primitives";
import { PricingTools } from "@/components/dashboard/pricing-tools";
import { PriceCell } from "@/components/dashboard/price-cell";
import { ProductImage } from "@/components/shop/product-image";

export function generateMetadata() {
  return pageMetadata((d) => d.admin.pricing.title);
}

type Search = {
  kunde?: string;
  maerke?: string;
  kategori?: string;
  q?: string;
};

/** How many products the table renders before it stops. */
const ROW_LIMIT = 150;

/**
 * Prissætning — the prototype's `katalog` view.
 *
 * Filters live in the URL rather than in client state: an admin who has narrowed
 * to one brand and applied a markup needs to be able to send that exact view to
 * a colleague, and a refresh must not silently reset the scope the bulk actions
 * are about to write against.
 */
export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const [dict, locale, params] = await Promise.all([
    getDictionary(),
    getLocale(),
    searchParams,
  ]);

  const t = dict.admin.pricing;

  const customers = await listPricingCustomers();
  const customer = customers.find((c) => c.id === params.kunde) ?? null;
  const brand = params.maerke || null;
  const category = params.kategori || null;
  const q = params.q?.trim() || null;

  const [brands, categories, rows] = await Promise.all([
    listCatalogueBrands(),
    listCatalogueCategories(brand ?? undefined),
    listPricingRows(
      {
        brand: brand ?? undefined,
        category: category ?? undefined,
        q: q ?? undefined,
        organisationId: customer?.id ?? null,
      },
      ROW_LIMIT,
    ),
  ]);

  const minimumDg = customer?.minimumDgPct ?? 35;
  const summary = summarise(rows, minimumDg);

  /** Builds a filter link that keeps every other filter intact. */
  const href = (next: Partial<Search>) => {
    const merged: Search = {
      kunde: params.kunde,
      maerke: brand ?? undefined,
      kategori: category ?? undefined,
      q: q ?? undefined,
      ...next,
    };
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value) qs.set(key, value);
    }
    const s = qs.toString();
    return `/${locale}/dashboard/admin/pricing${s ? `?${s}` : ""}`;
  };

  const scopeLabel =
    [brand, category].filter(Boolean).join(" · ") || t.scopeAll;

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      {/* Customer selector. A plain GET form, so it works before hydration and
          leaves a shareable URL behind. */}
      <form className="mb-6 flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1">
          <span className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
            {t.customer}
          </span>
          <select
            name="kunde"
            defaultValue={params.kunde ?? ""}
            className="mt-2 w-full rounded-sm border border-bone-300 bg-white px-3.5 py-2.5 text-[15px] text-ink-800 transition-colors hover:border-ink-300 focus:border-ink-900 focus:outline-none"
          >
            <option value="">{t.listPrices}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.pricedCount} {t.kpiVariants}
              </option>
            ))}
          </select>
        </label>
        {brand ? <input type="hidden" name="maerke" value={brand} /> : null}
        {category ? (
          <input type="hidden" name="kategori" value={category} />
        ) : null}
        {q ? <input type="hidden" name="q" value={q} /> : null}
        <button
          type="submit"
          className="rounded-md bg-ink-900 px-5 py-2.5 text-sm font-semibold text-bone-50 transition-colors hover:bg-ink-700"
        >
          {t.customer}
        </button>
        <p className="w-full text-xs text-ink-500">{t.listPricesHint}</p>
      </form>

      <StatGrid>
        <Stat
          label={t.kpiProducts}
          value={formatNumber(locale, summary.products)}
          sub={`${formatNumber(locale, summary.variants)} ${t.kpiVariants}`}
        />
        <Stat
          label={t.kpiMedianDg}
          value={summary.medianDg === null ? "—" : `${summary.medianDg} %`}
        />
        <Stat
          label={t.kpiBelowMin}
          value={formatNumber(locale, summary.belowMinimum)}
          sub={t.kpiBelowMinSub}
          tone={summary.belowMinimum > 0 ? "warning" : "success"}
        />
        <Stat
          label={t.kpiMinDg}
          value={`${minimumDg} %`}
          sub={t.kpiMinDgSub}
        />
      </StatGrid>

      {summary.missingCost > 0 ? (
        <p className="mt-4 rounded-md border border-warning/30 bg-warning/5 px-3.5 py-2.5 text-sm text-ink-800">
          {t.missingCost.replace("{n}", String(summary.missingCost))}
        </p>
      ) : null}

      <div className="mt-6">
        <PricingTools
          dict={t}
          organisationId={customer?.id ?? null}
          brand={brand}
          category={category}
          minimumDgPct={minimumDg}
          scopeLabel={scopeLabel}
        />
      </div>

      {/* Filters */}
      <div className="mt-8 flex flex-col gap-4">
        <FilterRow
          label={t.brand}
          all={t.all}
          allHref={href({ maerke: undefined, kategori: undefined })}
          active={brand}
          items={brands.map((b) => ({
            key: b.brand,
            label: b.brand,
            count: b.count,
            href: href({ maerke: b.brand, kategori: undefined }),
          }))}
        />
        <FilterRow
          label={t.category}
          all={t.all}
          allHref={href({ kategori: undefined })}
          active={category}
          items={categories.map((c) => ({
            key: c.category,
            label: c.category,
            count: c.count,
            href: href({ kategori: c.category }),
          }))}
        />

        <form className="flex flex-wrap items-end gap-3">
          {params.kunde ? (
            <input type="hidden" name="kunde" value={params.kunde} />
          ) : null}
          {brand ? <input type="hidden" name="maerke" value={brand} /> : null}
          {category ? (
            <input type="hidden" name="kategori" value={category} />
          ) : null}
          <label className="min-w-56 flex-1">
            <span className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
              {t.searchLabel}
            </span>
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder={t.searchPlaceholder}
              className="mt-2 w-full rounded-sm border border-bone-300 bg-white px-3.5 py-2.5 text-[15px] text-ink-800 transition-colors placeholder:text-ink-300 hover:border-ink-300 focus:border-ink-900 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="rounded-md border border-ink-900 px-4 py-2.5 text-sm font-semibold text-ink-900 transition-colors hover:bg-ink-900 hover:text-bone-50"
          >
            {t.searchSubmit}
          </button>
          {brand || category || q ? (
            <Link
              href={href({
                maerke: undefined,
                kategori: undefined,
                q: undefined,
              })}
              className="py-2.5 text-sm text-ink-500 transition-colors hover:text-ink-900"
            >
              {t.clear}
            </Link>
          ) : null}
        </form>
      </div>

      {summary.belowMinimum > 0 ? (
        <p className="mt-6 rounded-md border border-error/30 bg-error/5 px-3.5 py-2.5 text-sm text-ink-800">
          {t.underNote}
        </p>
      ) : null}

      <section className="mt-6 rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="text-[15px] font-semibold text-ink-900">
            {t.tableTitle}
          </h2>
          <span className="tabular text-sm text-ink-500">
            {formatNumber(locale, rows.length)}
            {rows.length === ROW_LIMIT ? "+" : ""}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="px-5 py-6">
            <EmptyState>{t.empty}</EmptyState>
          </div>
        ) : (
          // Scrolls inside its own box; the page never scrolls sideways.
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-500">
                  <th className="px-5 py-3 font-medium">{t.colProduct}</th>
                  <th className="px-3 py-3 text-right font-medium">
                    {t.colCost}
                  </th>
                  <th className="px-3 py-3 text-right font-medium">
                    {t.colPrice}
                  </th>
                  <th className="px-3 py-3 text-right font-medium">{t.colDg}</th>
                  <th className="px-3 py-3 text-right font-medium">
                    {t.colVariants}
                  </th>
                  {customer ? (
                    <th className="px-5 py-3 text-right font-medium">
                      {t.colAction}
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const tone = marginTone(r.dg, minimumDg);
                  const spread =
                    r.priceMin !== null &&
                    r.priceMax !== null &&
                    r.priceMax - r.priceMin > 0.01;

                  return (
                    <tr key={r.productId} className="border-b border-border">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="size-9 shrink-0 overflow-hidden rounded-sm bg-bone-100">
                            <ProductImage
                              src={r.image}
                              alt={r.name}
                              className="size-full object-contain"
                            />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-ink-900">
                              {r.name}
                            </span>
                            <span className="block truncate text-xs text-ink-500">
                              {r.brand} · {r.category}
                              {r.inAssortment ? (
                                <span className="ml-2 rounded-sm bg-highvis-50 px-1.5 py-0.5 text-[10px] font-semibold text-highvis-700">
                                  {t.inAssortment}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </div>
                      </td>

                      <td className="tabular px-3 py-3 text-right text-ink-700">
                        {r.costMin === null ? (
                          <span className="text-xs text-warning">
                            {t.noCost}
                          </span>
                        ) : (
                          formatMoney(locale, r.costMin)
                        )}
                      </td>

                      <td className="tabular px-3 py-3 text-right">
                        <span className="font-semibold text-ink-900">
                          {r.priceMin === null
                            ? "—"
                            : spread
                              ? `${t.priceFrom} ${formatMoney(locale, r.priceMin)}`
                              : formatMoney(locale, r.priceMin)}
                        </span>
                        <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                          {r.hasAgreedPrice ? t.agreed : t.list}
                        </span>
                      </td>

                      <td className="tabular px-3 py-3 text-right">
                        {r.dg === null ? (
                          <span className="text-ink-400">—</span>
                        ) : (
                          <span
                            className={`rounded-sm px-2 py-0.5 text-xs font-bold ${
                              tone === "under"
                                ? "bg-error/10 text-error"
                                : tone === "warning"
                                  ? "bg-warning/15 text-warning"
                                  : "bg-success/10 text-success"
                            }`}
                          >
                            {r.dg} %
                          </span>
                        )}
                      </td>

                      <td className="tabular px-3 py-3 text-right text-ink-500">
                        {r.variantCount}
                      </td>

                      {customer ? (
                        <td className="px-5 py-3">
                          <PriceCell
                            organisationId={customer.id}
                            productId={r.productId}
                            defaultValue={
                              r.priceMin === null ? "" : String(r.priceMin)
                            }
                            saveLabel={t.setPrice}
                            savingLabel={t.setPriceSaving}
                            ariaLabel={`${t.colAction} — ${r.name}`}
                          />
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function FilterRow({
  label,
  all,
  allHref,
  active,
  items,
}: {
  label: string;
  all: string;
  allHref: string;
  active: string | null;
  items: { key: string; label: string; count: number; href: string }[];
}) {
  return (
    <div>
      <p className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
        {label}
      </p>
      {/* Scrolls sideways on a phone rather than wrapping into five rows. */}
      <div className="-mx-4 mt-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2">
          <Chip href={allHref} label={all} on={active === null} />
          {items.map((i) => (
            <Chip
              key={i.key}
              href={i.href}
              label={i.label}
              count={i.count}
              on={active === i.key}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Chip({
  href,
  label,
  count,
  on,
}: {
  href: string;
  label: string;
  count?: number;
  on: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
        on
          ? "border-ink-900 bg-ink-900 text-bone-50"
          : "border-border bg-card text-ink-700 hover:border-ink-900"
      }`}
    >
      {label}
      {count !== undefined ? (
        <span className="tabular ml-1.5 text-xs opacity-60">{count}</span>
      ) : null}
    </Link>
  );
}
