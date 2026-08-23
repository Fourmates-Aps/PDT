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

/** Where each order status sits on the customer-facing tracker. */
const TRACKER_STEP: Record<string, number> = {
  draft: 0,
  pending_approval: 0,
  approved: 0,
  in_production: 1,
  packing: 2,
  shipped: 3,
  delivered: 4,
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
  const cancelled = order.status === "cancelled";
  const steps = [
    t.tracker.received,
    t.tracker.production,
    t.tracker.packing,
    t.tracker.shipped,
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
        <Badge variant={cancelled ? "destructive" : "outline"}>
          {dict.cadmin.orders.statuses[order.status]}
        </Badge>
      </div>

      {!cancelled ? (
        <section className="mt-6 rounded-lg border border-border bg-card p-5">
          <h2 className="font-semibold text-ink-900">{t.trackerTitle}</h2>
          {/* Vertical on phones, horizontal once there is room — a five-step
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
