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
 * The queue is ordered by what can be worked on now: goods that are here,
 * then work in print, then what can be booked in, then anything the supplier
 * has not shipped, and finally today's dispatches. A picker should not have to
 * scroll past four blocked orders to find the one they can actually start.
 */
export default async function WarehousePage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.warehouse.packship;

  const queue = await listPackQueue();

  // Dispatched orders are still in the queue — dispatch does not move an order
  // (Q-C2 c) — but there is nothing left to do to them, so they sort to the end.
  const dispatched = queue.filter((o) => o.dispatchedAt !== null);
  const open = queue.filter((o) => o.dispatchedAt === null);

  const arrived = open.filter((o) => o.status === "arrived_at_warehouse");
  const printing = open.filter((o) => o.status === "sent_to_print");
  const incoming = open.filter((o) => o.status === "booked" && o.readyToPick);
  const waiting = open.filter((o) => o.status === "booked" && !o.readyToPick);

  const ordered = [...arrived, ...printing, ...incoming, ...waiting, ...dispatched];

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      <StatGrid>
        <Stat
          label={t.kpiArrived}
          value={formatNumber(locale, arrived.length)}
          sub={t.kpiArrivedSub}
          tone={arrived.length > 0 ? "success" : "default"}
        />
        <Stat
          label={t.kpiWaiting}
          value={formatNumber(locale, waiting.length)}
          sub={t.kpiWaitingSub}
          tone={waiting.length > 0 ? "warning" : "default"}
        />
        <Stat label={t.kpiPrint} value={formatNumber(locale, printing.length)} />
        <Stat
          label={t.kpiDispatched}
          value={formatNumber(locale, dispatched.length)}
          sub={t.kpiDispatchedSub}
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
