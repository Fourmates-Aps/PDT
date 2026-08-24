import { pageMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { listPackQueue } from "@/lib/db/queries/production";
import { formatNumber } from "@/lib/format";
import {
  EmptyState,
  PageHeader,
  Stat,
  StatGrid,
} from "@/components/dashboard/primitives";
import { PackOrderCard } from "@/components/dashboard/pack-ship";

export function generateMetadata() {
  return pageMetadata((d) => d.warehouse.packship.title);
}

/**
 * Pak & send — the prototype's `packship`.
 *
 * The queue is ordered by what can be worked on now: pickable orders first,
 * then anything waiting on a supplier, then work already in progress. A picker
 * should not have to scroll past four blocked orders to find the one they can
 * actually start.
 */
export default async function WarehousePage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.warehouse.packship;

  const queue = await listPackQueue();

  const ready = queue.filter((o) => o.status === "approved" && o.readyToPick);
  const waiting = queue.filter((o) => o.status === "approved" && !o.readyToPick);
  const printing = queue.filter((o) => o.status === "in_production");
  const packing = queue.filter((o) => o.status === "packing");
  const shipped = queue.filter((o) => o.status === "shipped");

  const ordered = [...ready, ...packing, ...printing, ...waiting, ...shipped];

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      <StatGrid>
        <Stat
          label={t.kpiNew}
          value={formatNumber(locale, ready.length)}
          sub={t.kpiNewSub}
          tone={ready.length > 0 ? "success" : "default"}
        />
        <Stat
          label={t.kpiWaiting}
          value={formatNumber(locale, waiting.length)}
          sub={t.kpiWaitingSub}
          tone={waiting.length > 0 ? "warning" : "default"}
        />
        <Stat label={t.kpiPrint} value={formatNumber(locale, printing.length)} />
        <Stat
          label={t.kpiShipped}
          value={formatNumber(locale, shipped.length)}
          sub={t.kpiShippedSub}
        />
      </StatGrid>

      {ordered.length === 0 ? (
        <div className="mt-8 rounded-lg border border-border bg-card px-5 py-6">
          <EmptyState>{t.empty}</EmptyState>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {ordered.map((order) => (
            <li key={order.id}>
              <PackOrderCard
                order={order}
                dict={t}
                placements={dict.shop.logo.placements}
                locale={locale}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
