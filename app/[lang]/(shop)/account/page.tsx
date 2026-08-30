import Link from "next/link";
import { pageMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getSessionUser } from "@/lib/supabase/server";
import {
  getAllowanceSummary,
  getMember,
  listMyOrders,
} from "@/lib/db/queries/shop";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  Stat,
  StatGrid,
  UsageBar,
} from "@/components/dashboard/primitives";
import { Badge } from "@/components/ui/badge";
import { formatAllowance, formatDate, formatMoney } from "@/lib/format";
import { orderBadgeTone } from "@/lib/production";

export function generateMetadata() {
  return pageMetadata((d) => d.shop.account.title);
}

/**
 * The employee's own overview: what is left of the allowance, and what they
 * have ordered. Everything is scoped to the signed-in member — an employee
 * never sees a colleague's balance or basket.
 */
export default async function AccountPage() {
  const [dict, locale, user] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSessionUser(),
  ]);

  const t = dict.shop.account;
  const organisationId = user?.organisationId;

  if (!user || !organisationId) {
    return (
      <>
        <PageHeader title={t.title} lead={t.lead} />
        <EmptyState>{dict.shop.grid.noOrg}</EmptyState>
      </>
    );
  }

  const member = await getMember(user.id, organisationId);
  const [allowance, orders] = await Promise.all([
    getAllowanceSummary(organisationId, member?.id ?? null),
    member ? listMyOrders(member.id, organisationId) : [],
  ]);

  const amount = (value: number | string) =>
    formatAllowance(
      locale,
      value,
      allowance.displayMode,
      dict.shop.allowance.points,
    );

  const recent = orders.slice(0, 5);

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-start">
        <section className="rounded-lg border border-border bg-card p-5">
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
            {t.allowanceTitle}
          </p>

          {allowance.hasQuota ? (
            <>
              <p className="tabular mt-2 text-3xl font-bold text-ink-900">
                {amount(allowance.remaining)}
              </p>
              <p className="mt-1 text-sm text-ink-500">{t.remaining}</p>
              <div className="mt-4">
                <UsageBar pct={allowance.pct} />
              </div>
              <p className="tabular mt-2 text-xs text-ink-500">
                {dict.shop.allowance.usedOf
                  .replace("{used}", amount(allowance.used))
                  .replace("{total}", amount(allowance.allowance))}
              </p>
              {allowance.periodEnd ? (
                <p className="mt-1 text-xs text-ink-500">
                  {dict.shop.allowance.renew.replace(
                    "{date}",
                    formatDate(locale, allowance.periodEnd),
                  )}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm text-ink-800">
              {dict.shop.allowance.none}
            </p>
          )}

          <nav className="mt-6 border-t border-border pt-4">
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
              {t.linksTitle}
            </p>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {[
                [`/${locale}/shop`, t.shop],
                [`/${locale}/size-guide`, t.sizeGuide],
                [`/${locale}/returns`, t.returns],
              ].map(([href, label]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-ink-700 transition-colors hover:text-highvis-700"
                  >
                    {label} →
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </section>

        <div className="flex flex-col gap-4">
          <StatGrid>
            <Stat label={t.remaining} value={amount(allowance.remaining)} />
            <Stat
              label={t.spent}
              value={amount(allowance.used)}
              sub={`${allowance.pct}%`}
            />
            <Stat
              label={t.ordersKpi}
              value={orders.length}
              sub={t.ordersKpiSub}
            />
            <Stat
              label={t.cap}
              value={
                allowance.approvalLimit > 0
                  ? formatMoney(locale, allowance.approvalLimit)
                  : "—"
              }
              sub={t.capSub}
            />
          </StatGrid>

          <SectionCard
            title={t.recent}
            action={
              orders.length > 0 ? (
                <Link
                  href={`/${locale}/orders`}
                  className="text-sm font-medium text-ink-500 transition-colors hover:text-ink-900"
                >
                  {t.viewAll} →
                </Link>
              ) : undefined
            }
          >
            {recent.length === 0 ? (
              <EmptyState>{t.empty}</EmptyState>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {recent.map((o) => (
                  <li key={o.id} className="first:pt-0 last:pb-0">
                    <Link
                      href={`/${locale}/orders/${o.orderNumber}`}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 transition-colors hover:text-highvis-700"
                    >
                      <div className="min-w-0">
                        <p className="tabular text-sm font-semibold text-ink-900">
                          {o.orderNumber}
                        </p>
                        <p className="tabular text-xs text-ink-500">
                          {formatDate(locale, o.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={orderBadgeTone(o.status)}>
                          {dict.cadmin.orders.statuses[o.status]}
                        </Badge>
                        <span className="tabular text-sm font-semibold text-ink-900">
                          {/* Orders are settled in kroner even in points mode:
                              the personal share is a real charge. */}
                          {formatMoney(locale, o.totalDkk)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </>
  );
}
