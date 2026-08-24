import { pageMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import {
  boardSummary,
  listBoardCards,
  toColumns,
} from "@/lib/db/queries/production";
import { formatNumber } from "@/lib/format";
import { PageHeader, Stat, StatGrid } from "@/components/dashboard/primitives";
import { ProductionBoard } from "@/components/dashboard/production-board";

export function generateMetadata() {
  return pageMetadata((d) => d.admin.production.title);
}

/**
 * Produktionsflow — the prototype's `produktion` kanban.
 *
 * Reads `orders` directly: the board IS the order state, not a mirror of it.
 * Everything shown here is also visible to the warehouse at /dashboard/warehouse,
 * and both write through the same actions.
 */
export default async function ProductionPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.admin.production;

  const cards = await listBoardCards();
  const columns = toColumns(cards);
  const summary = boardSummary(cards);

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      <StatGrid>
        <Stat
          label={t.kpiActive}
          value={formatNumber(locale, summary.active)}
          sub={t.kpiActiveSub.replace(
            "{n}",
            formatNumber(locale, summary.units),
          )}
        />
        <Stat
          label={t.kpiLate}
          value={formatNumber(locale, summary.late)}
          sub={t.kpiLateSub}
          tone={summary.late > 0 ? "warning" : "success"}
        />
        <Stat
          label={t.kpiWeek}
          value={formatNumber(locale, summary.dueThisWeek)}
        />
        <Stat
          label={t.kpiShipped}
          value={formatNumber(locale, summary.shipped)}
          sub={t.kpiShippedSub}
        />
      </StatGrid>

      {summary.late > 0 ? (
        <p className="mt-4 rounded-md border border-error/30 bg-error/5 px-3.5 py-2.5 text-sm text-ink-800">
          {t.lateBanner.replace("{n}", String(summary.late))}
        </p>
      ) : null}

      <div className="mt-6">
        <ProductionBoard
          columns={columns}
          dict={t}
          locale={locale}
          warehouseHref={`/${locale}/dashboard/warehouse`}
        />
      </div>

      {/* Says where the dates come from, because they are derived rather than
          agreed with the customer. */}
      <p className="mt-6 text-xs leading-relaxed text-ink-500">{t.dateNote}</p>
    </>
  );
}
