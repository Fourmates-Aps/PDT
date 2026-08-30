import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getSessionUser } from "@/lib/supabase/server";
import { getMember, getMyOrder } from "@/lib/db/queries/shop";
import { ProductImage } from "@/components/shop/product-image";
import { EmptyState } from "@/components/dashboard/primitives";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney } from "@/lib/format";
import { isStopped, orderBadgeTone } from "@/lib/production";

/**
 * Where each order status sits on the customer-facing tracker.
 *
 * The four steps are D-3's stages, in order. `pending_approval` is BEFORE the
 * first one — nothing has been booked yet — so it reads as -1 and the tracker
 * shows a waiting note instead of a completed step. Cancelled and rejected
 * orders (Q-C3) replace the tracker entirely: there is no progress to show.
 */
const TRACKER_STEP: Record<string, number> = {
  pending_approval: -1,
  booked: 0,
  arrived_at_warehouse: 1,
  sent_to_print: 2,
  delivered: 3,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}): Promise<Metadata> {
  const { orderNumber } = await params;
  return {
    title: `${orderNumber} — Profil Design Trading`,
    robots: { index: false, follow: false },
  };
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const [dict, locale, user, { orderNumber }] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSessionUser(),
    params,
  ]);

  const t = dict.shop.orders;
  const organisationId = user?.organisationId;

  if (!user || !organisationId) {
    return <EmptyState>{dict.shop.grid.noOrg}</EmptyState>;
  }

  const member = await getMember(user.id, organisationId);
  if (!member) return <EmptyState>{dict.shop.grid.noOrg}</EmptyState>;

  // Query is scoped to this member, so another employee's order number 404s
  // rather than leaking what they bought.
  const result = await getMyOrder(member.id, organisationId, orderNumber);
  if (!result) notFound();

  const { order, lines } = result;
  const step = TRACKER_STEP[order.status] ?? 0;
  const stopped = isStopped(order.status);
  const steps = [
    t.tracker.booked,
    t.tracker.arrived,
    t.tracker.print,
    t.tracker.delivered,
  ];

  return (
    <>
      <Link
        href={`/${locale}/orders`}
        className="text-sm text-ink-500 transition-colors hover:text-ink-900"
      >
        {t.back}
      </Link>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="tabular text-h2 font-display font-semibold text-ink-900">
            {order.orderNumber}
          </h1>
          <p className="tabular mt-1 text-sm text-ink-500">
            {formatDate(locale, order.createdAt)}
          </p>
        </div>
        <Badge variant={orderBadgeTone(order.status)}>
          {dict.cadmin.orders.statuses[order.status]}
        </Badge>
      </div>

      {!stopped ? (
        <section className="mt-6 rounded-lg border border-border bg-card p-5">
          <h2 className="font-semibold text-ink-900">{t.trackerTitle}</h2>

          {/* Waiting on a decision is not a step — the order has not started. */}
          {step < 0 ? (
            <p className="mt-3 rounded-md border border-warning/30 bg-warning/5 px-3.5 py-2.5 text-sm text-ink-800">
              {t.tracker.awaitingApproval}
            </p>
          ) : null}
          {/* Vertical on phones, horizontal once there is room — a four-step
              horizontal tracker at 390px is unreadable. */}
          <ol className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-0">
            {steps.map((label, i) => {
              const done = i <= step;
              return (
                <li
                  key={label}
                  className="flex items-center gap-3 sm:flex-1 sm:flex-col sm:gap-2 sm:text-center"
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      done
                        ? "bg-ink-900 text-bone-50"
                        : "bg-bone-200 text-ink-400"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span
                    className={`text-sm ${done ? "font-medium text-ink-900" : "text-ink-400"}`}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>

          {/*
            * The parcel can be on its way while the order still reads as being
            * in print — dispatch does not move it (Q-C2 c). The tracking link
            * is what tells the customer it has left.
            */}
          {order.glsTrackUrl ? (
            <a
              href={order.glsTrackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm font-semibold text-highvis-700 hover:text-highvis-800"
            >
              {t.trackingLink} →
            </a>
          ) : null}
        </section>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-semibold text-ink-900">{t.lines}</h2>
          <ul className="mt-4 divide-y divide-border">
            {lines.map((l) => (
              <li key={l.id} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                <div className="size-16 shrink-0 overflow-hidden rounded-md bg-bone-100">
                  <ProductImage
                    src={l.image}
                    alt={l.productName}
                    className="size-full object-contain"
                  />
                </div>
                <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900">
                      {l.productName}
                    </p>
                    <p className="tabular text-xs text-ink-500">
                      {[l.colourName, l.size].filter(Boolean).join(" · ")}
                    </p>
                    <p className="tabular mt-1 text-xs text-ink-500">
                      {t.qty} {l.quantity} · {formatMoney(locale, l.unitPriceDkk)}
                    </p>
                  </div>
                  <span className="tabular shrink-0 text-sm font-semibold text-ink-900">
                    {formatMoney(locale, l.lineTotalDkk)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <aside className="rounded-lg border border-border bg-card p-5">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-500">{t.onAccount}</dt>
              <dd className="tabular font-semibold text-ink-800">
                {formatMoney(locale, order.accountAmountDkk)}
              </dd>
            </div>
            {Number(order.personalAmountDkk) > 0 ? (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">{t.personal}</dt>
                <dd className="tabular font-semibold text-ink-800">
                  {formatMoney(locale, order.personalAmountDkk)}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3 border-t border-border pt-2">
              <dt className="font-semibold text-ink-900">{t.total}</dt>
              <dd className="tabular text-base font-bold text-ink-900">
                {formatMoney(locale, order.totalDkk)}
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </>
  );
}
