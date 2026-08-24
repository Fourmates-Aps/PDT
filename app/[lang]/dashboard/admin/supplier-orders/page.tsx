import Link from "next/link";
import { pageMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import {
  listBaskets,
  listReleasedOrders,
  listShortfalls,
} from "@/lib/db/queries/suppliers";
import { formatDate, formatNumber } from "@/lib/format";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  Stat,
  StatGrid,
} from "@/components/dashboard/primitives";
import { GatherDemand } from "@/components/dashboard/gather-demand";
import { SupplierBasketCard } from "@/components/dashboard/supplier-basket";

export function generateMetadata() {
  return pageMetadata((d) => d.admin.supplierOrders.title);
}

/**
 * Ordre & leverandør — the prototype's `ordreflow`.
 *
 * Three things in order: what customers are waiting for that stock cannot
 * cover, what has been pooled towards each supplier's minimum, and what has
 * already been sent.
 */
export default async function SupplierOrdersPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.admin.supplierOrders;

  const [shortfalls, baskets, released] = await Promise.all([
    listShortfalls(),
    listBaskets(),
    listReleasedOrders(),
  ]);

  const openBaskets = baskets.filter((b) => b.units > 0);
  const ready = openBaskets.filter((b) => b.meetsMinimum);

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      <StatGrid>
        <Stat
          label={t.kpiShortfall}
          value={formatNumber(locale, shortfalls.length)}
          sub={t.kpiShortfallSub}
          tone={shortfalls.length > 0 ? "warning" : "success"}
        />
        <Stat
          label={t.kpiBaskets}
          value={formatNumber(locale, openBaskets.length)}
        />
        <Stat
          label={t.kpiReady}
          value={formatNumber(locale, ready.length)}
          sub={t.kpiReadySub}
          tone={ready.length > 0 ? "success" : "default"}
        />
        <Stat
          label={t.kpiReleased}
          value={formatNumber(locale, released.length)}
          sub={t.kpiReleasedSub}
        />
      </StatGrid>

      <div className="mt-6">
        <GatherDemand dict={t} />
      </div>

      <SectionCard
        title={t.shortfallTitle}
        lead={t.shortfallLead}
        className="mt-6"
      >
        {shortfalls.length === 0 ? (
          <EmptyState>{t.shortfallEmpty}</EmptyState>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-ink-500">
                  <th className="py-2 pr-3 font-medium">{t.colOrder}</th>
                  <th className="py-2 pr-3 font-medium">{t.colCustomer}</th>
                  <th className="py-2 pr-3 font-medium">{t.colProduct}</th>
                  <th className="py-2 pr-3 text-right font-medium">
                    {t.colOrdered}
                  </th>
                  <th className="py-2 pr-3 text-right font-medium">
                    {t.colStock}
                  </th>
                  <th className="py-2 text-right font-medium">{t.colShort}</th>
                </tr>
              </thead>
              <tbody>
                {shortfalls.map((s) => (
                  <tr key={s.orderLineId} className="border-t border-border">
                    <td className="tabular py-2.5 pr-3 font-semibold text-ink-900">
                      {s.orderNumber}
                    </td>
                    <td className="py-2.5 pr-3 text-ink-700">{s.customer}</td>
                    <td className="py-2.5 pr-3">
                      <span className="block text-ink-900">{s.productName}</span>
                      <span className="block text-xs text-ink-500">
                        {[s.colourName, s.size].filter(Boolean).join(" · ")} ·{" "}
                        {s.supplierCode}
                      </span>
                    </td>
                    <td className="tabular py-2.5 pr-3 text-right text-ink-700">
                      {s.ordered}
                    </td>
                    <td className="tabular py-2.5 pr-3 text-right text-ink-700">
                      {s.stockQty}
                    </td>
                    <td className="tabular py-2.5 text-right font-bold text-warning">
                      {s.shortfall}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <h2 className="mt-10 font-display text-h3 font-semibold text-ink-900">
        {t.basketsTitle}
      </h2>

      {openBaskets.length === 0 ? (
        <div className="mt-4 rounded-lg border border-border bg-card px-5 py-6">
          <EmptyState>{t.basketEmpty}</EmptyState>
        </div>
      ) : (
        <ul className="mt-4 grid gap-4 xl:grid-cols-2">
          {openBaskets.map((basket) => (
            <li key={basket.supplierId}>
              <SupplierBasketCard
                basket={basket}
                dict={t}
                channelLabel={dict.admin.suppliers.channels[basket.orderChannel]}
                locale={locale}
              />
            </li>
          ))}
        </ul>
      )}

      <SectionCard title={t.releasedTitle} className="mt-10">
        {released.length === 0 ? (
          <EmptyState>{t.releasedEmpty}</EmptyState>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-ink-500">
                  <th className="py-2 pr-3 font-medium">{t.colSupplier}</th>
                  <th className="py-2 pr-3 font-medium">{t.colChannel}</th>
                  <th className="py-2 pr-3 text-right font-medium">
                    {t.colUnits}
                  </th>
                  <th className="py-2 pr-3 font-medium">{t.colReleased}</th>
                  <th className="py-2 font-medium">{t.colStatus}</th>
                </tr>
              </thead>
              <tbody>
                {released.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2.5 pr-3 font-semibold text-ink-900">
                      {r.supplierName}
                    </td>
                    <td className="py-2.5 pr-3 text-ink-700">
                      {dict.admin.suppliers.channels[r.orderChannel]}
                    </td>
                    <td className="tabular py-2.5 pr-3 text-right text-ink-900">
                      {r.units}
                    </td>
                    <td className="tabular py-2.5 pr-3 text-ink-500">
                      {formatDate(locale, r.releasedAt)}
                    </td>
                    <td className="py-2.5 text-ink-700">
                      {t.statuses[r.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* States plainly that nothing is transmitted yet. */}
      <p className="mt-6 text-xs leading-relaxed text-ink-500">
        {t.notLive}{" "}
        <Link
          href={`/${locale}/dashboard/admin/suppliers`}
          className="font-semibold text-ink-700 underline underline-offset-2 hover:text-ink-900"
        >
          {dict.admin.suppliers.title}
        </Link>
      </p>
    </>
  );
}
