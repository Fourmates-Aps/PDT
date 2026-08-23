import { pageMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getSessionUser } from "@/lib/supabase/server";
import {
  getOrganisation,
  listPendingApprovals,
} from "@/lib/db/queries/customer";
import {
  EmptyState,
  PageHeader,
  SectionCard,
} from "@/components/dashboard/primitives";
import { ActionForm } from "@/components/dashboard/action-form";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney, toNumber } from "@/lib/format";
import { decideApprovalAction } from "../actions";

export function generateMetadata() {
  return pageMetadata((d) => d.cadmin.approvals.title);
}

export default async function ApprovalsPage() {
  const [dict, locale, user] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSessionUser(),
  ]);

  const t = dict.cadmin.approvals;
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
    listPendingApprovals(organisationId),
  ]);

  const limit = toNumber(org?.orderApprovalLimitDkk);

  return (
    <>
      <PageHeader
        title={t.title}
        lead={t.lead}
        action={
          rows.length > 0 ? (
            <Badge variant="outline" className="tabular">
              {rows.length} {t.pendingCount}
            </Badge>
          ) : null
        }
      />

      {rows.length === 0 ? (
        <SectionCard title={t.title}>
          <EmptyState>{t.empty}</EmptyState>
        </SectionCard>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((r) => {
            const over = toNumber(r.totalDkk) > limit && limit > 0;
            return (
              <li
                key={r.id}
                className="rounded-lg border border-border bg-card p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="tabular font-semibold text-ink-900">
                      {r.orderNumber}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-500">
                      {t.requestedBy} {r.requesterName ?? "—"} ·{" "}
                      {formatDate(locale, r.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                    <span className="tabular text-lg font-bold text-ink-900">
                      {formatMoney(locale, r.totalDkk)}
                    </span>
                    {over ? (
                      <Badge variant="outline" className="text-warning">
                        {t.overLimit} {formatMoney(locale, limit)}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                {/* Two separate forms so each button carries its own decision
                    and its own pending state. */}
                <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-end sm:gap-3">
                  <ActionForm
                    action={decideApprovalAction}
                    submitLabel={t.approve}
                    pendingLabel={t.approving}
                    className="flex-1"
                  >
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="approvalId" value={r.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <label className="block">
                      <span className="sr-only">{t.note}</span>
                      <input
                        name="notes"
                        placeholder={t.note}
                        className="w-full rounded-sm border border-input bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-ink-300 focus:border-ink-900 focus:outline-none"
                      />
                    </label>
                  </ActionForm>

                  <ActionForm
                    action={decideApprovalAction}
                    submitLabel={t.reject}
                    pendingLabel={t.rejecting}
                    variant="quiet"
                  >
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="approvalId" value={r.id} />
                    <input type="hidden" name="decision" value="rejected" />
                  </ActionForm>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
