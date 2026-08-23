import { pageMetadata } from "@/lib/page-metadata";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getSessionUser } from "@/lib/supabase/server";
import {
  getLowBalances,
  getOrganisation,
  getOverview,
  getRecentOrders,
} from "@/lib/db/queries/customer";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  Stat,
  StatGrid,
  UsageBar,
} from "@/components/dashboard/primitives";
import { Badge } from "@/components/ui/badge";
import {
  formatAllowance,
  formatDate,
  formatMoney,
  toNumber,
  usagePct,
} from "@/lib/format";

export function generateMetadata() {
  return pageMetadata((d) => d.cadmin.overview.title);
}

export default async function CustomerOverviewPage() {
  const [dict, locale, user] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSessionUser(),
  ]);

  const t = dict.cadmin.overview;
  const organisationId = user?.organisationId;

  if (!organisationId) {
    return (
      <>
        <PageHeader title={t.title} lead={t.lead} />
        <EmptyState>{dict.auth.employees.noOrg}</EmptyState>
      </>
    );
  }

  const [org, overview, lowBalances, recent] = await Promise.all([
    getOrganisation(organisationId),
    getOverview(organisationId),
    getLowBalances(organisationId),
    getRecentOrders(organisationId),
  ]);

  const mode = org?.displayMode ?? "price";
  const base = `/${locale}/dashboard/customer`;

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      <StatGrid>
        <Stat
          label={t.kpiEmployees}
          value={overview.memberCount}
          sub={t.kpiEmployeesSub}
        />
        <Stat
          label={t.kpiPending}
          value={overview.pendingApprovals}
          sub={
            overview.pendingApprovals > 0 ? t.kpiPendingSub : t.kpiPendingNone
          }
          tone={overview.pendingApprovals > 0 ? "warning" : "success"}
        />
        <Stat
          label={t.kpiAllowance}
          value={formatAllowance(
            locale,
            org?.defaultAllowanceDkk,
            mode,
            dict.cadmin.common.points,
          )}
          sub={dict.cadmin.common.perYear}
        />
        <Stat
          label={t.kpiSpend}
          value={formatMoney(locale, overview.spendYtd)}
          sub={t.kpiSpendSub}
        />
      </StatGrid>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard
          title={t.lowBalanceTitle}
          lead={t.lowBalanceLead}
          action={
            <Link
              href={`${base}/clothing-account`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-highvis-700 hover:text-highvis-800"
            >
              {t.viewAll}
              <ArrowRight className="size-3.5" />
            </Link>
          }
        >
          {lowBalances.length === 0 ? (
            <EmptyState>{t.lowBalanceEmpty}</EmptyState>
          ) : (
            <ul className="flex flex-col gap-4">
              {lowBalances.map((row) => {
                const pct = usagePct(row.usedDkk, row.allowanceDkk);
                const left =
                  toNumber(row.allowanceDkk) - toNumber(row.usedDkk);
                return (
                  <li key={row.memberId}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-medium text-ink-900">
                        {row.fullName ?? "—"}
                      </span>
                      <span className="tabular shrink-0 text-xs text-ink-500">
                        {formatAllowance(
                          locale,
                          left,
                          mode,
                          dict.cadmin.common.points,
                        )}{" "}
                        {dict.cadmin.common.remaining}
                      </span>
                    </div>
                    <div className="mt-2">
                      <UsageBar pct={pct} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={t.recentOrdersTitle}
          action={
            <Link
              href={`${base}/orders`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-highvis-700 hover:text-highvis-800"
            >
              {t.viewAll}
              <ArrowRight className="size-3.5" />
            </Link>
          }
        >
          {recent.length === 0 ? (
            <EmptyState>{t.recentOrdersEmpty}</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="tabular text-sm font-semibold text-ink-900">
                      {o.orderNumber}
                    </p>
                    <p className="truncate text-xs text-ink-500">
                      {o.memberName ?? "—"} · {formatDate(locale, o.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">
                      {dict.cadmin.orders.statuses[o.status]}
                    </Badge>
                    <span className="tabular text-sm font-semibold text-ink-900">
                      {formatMoney(locale, o.totalDkk)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title={t.quickTitle} className="mt-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { href: `${base}/employees`, label: t.quickInvite },
            { href: `${base}/approvals`, label: t.quickApprovals },
            { href: `${base}/settings`, label: t.quickSettings },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-4 py-3 text-sm font-medium text-ink-800 transition-colors hover:border-ink-900 hover:bg-secondary"
            >
              {a.label}
              <ArrowRight className="size-4 shrink-0 text-ink-400" />
            </Link>
          ))}
        </div>
      </SectionCard>
    </>
  );
}
