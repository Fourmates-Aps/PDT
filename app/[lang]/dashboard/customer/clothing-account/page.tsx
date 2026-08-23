import { pageMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getSessionUser } from "@/lib/supabase/server";
import { getOrganisation, listQuotas } from "@/lib/db/queries/customer";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  Stat,
  StatGrid,
  UsageBar,
} from "@/components/dashboard/primitives";
import { ActionForm } from "@/components/dashboard/action-form";
import { Badge } from "@/components/ui/badge";
import {
  formatAllowance,
  formatMoney,
  toNumber,
  usagePct,
} from "@/lib/format";
import { setQuotaAction } from "../actions";

export function generateMetadata() {
  return pageMetadata((d) => d.cadmin.clothing.title);
}

export default async function ClothingAccountPage() {
  const [dict, locale, user] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSessionUser(),
  ]);

  const t = dict.cadmin.clothing;
  const organisationId = user?.organisationId;

  if (!organisationId) {
    return (
      <>
        <PageHeader title={t.title} lead={t.lead} />
        <EmptyState>{dict.auth.employees.noOrg}</EmptyState>
      </>
    );
  }

  const [org, rows] = await Promise.all([
    getOrganisation(organisationId),
    listQuotas(organisationId),
  ]);

  const mode = org?.displayMode ?? "price";
  const pointsLabel = dict.cadmin.common.points;
  const defaultAllowance = toNumber(org?.defaultAllowanceDkk);

  const withQuota = rows.filter((r) => r.quotaId);
  const totalAllowance = withQuota.reduce(
    (sum, r) => sum + toNumber(r.allowanceDkk),
    0,
  );
  const totalUsed = withQuota.reduce((sum, r) => sum + toNumber(r.usedDkk), 0);
  const totalPct = usagePct(totalUsed, totalAllowance);

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      <StatGrid>
        <Stat
          label={dict.cadmin.overview.kpiAllowance}
          value={formatAllowance(locale, defaultAllowance, mode, pointsLabel)}
          sub={dict.cadmin.common.perYear}
        />
        <Stat
          label={t.spent}
          value={formatAllowance(locale, totalUsed, mode, pointsLabel)}
          sub={`${totalPct}% ${dict.cadmin.common.used}`}
          tone={totalPct >= 85 ? "warning" : "default"}
        />
        <Stat
          label={t.left}
          value={formatAllowance(
            locale,
            Math.max(0, totalAllowance - totalUsed),
            mode,
            pointsLabel,
          )}
        />
        <Stat
          label={dict.cadmin.overview.kpiEmployees}
          value={withQuota.length}
          sub={t.totalSub.replace("{count}", String(rows.length))}
        />
      </StatGrid>

      <SectionCard title={t.title} className="mt-6">
        {rows.length === 0 ? (
          <EmptyState>{t.empty}</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const has = Boolean(r.quotaId);
              const pct = has ? usagePct(r.usedDkk, r.allowanceDkk) : 0;
              const left = toNumber(r.allowanceDkk) - toNumber(r.usedDkk);
              const low = has && pct >= 55;

              return (
                <li key={r.memberId} className="py-4 first:pt-0 last:pb-0">
                  {/* Stacks on phones, becomes a row once there is width. */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink-900">
                        {r.fullName ?? "—"}
                      </p>
                      <p className="text-sm text-ink-500">
                        {dict.auth.roles[r.role]}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 sm:justify-end">
                      {has ? (
                        <>
                          <Badge variant={low ? "outline" : "secondary"}>
                            {low ? t.lowTag : t.okTag}
                          </Badge>
                          <span className="tabular text-sm font-semibold text-ink-900">
                            {formatAllowance(locale, left, mode, pointsLabel)}
                          </span>
                        </>
                      ) : (
                        <Badge variant="outline">{t.noQuota}</Badge>
                      )}
                    </div>
                  </div>

                  {has ? (
                    <div className="mt-3">
                      <UsageBar pct={pct} />
                      <p className="tabular mt-1.5 text-xs text-ink-500">
                        {formatMoney(locale, r.usedDkk)}{" "}
                        {dict.cadmin.common.of}{" "}
                        {formatMoney(locale, r.allowanceDkk)}
                      </p>
                    </div>
                  ) : null}

                  <ActionForm
                    action={setQuotaAction}
                    submitLabel={has ? t.topUp : t.assign}
                    pendingLabel={t.topUpSaving}
                    variant="quiet"
                    className="mt-3 flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="memberId" value={r.memberId} />
                    <input
                      name="allowance"
                      type="text"
                      inputMode="decimal"
                      defaultValue={
                        has
                          ? String(toNumber(r.allowanceDkk))
                          : String(defaultAllowance)
                      }
                      aria-label={t.assign}
                      className="w-28 rounded-sm border border-input bg-white px-3 py-1.5 text-sm text-ink-800 focus:border-ink-900 focus:outline-none"
                    />
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
