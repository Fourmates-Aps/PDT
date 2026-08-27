import { pageMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getSessionUser } from "@/lib/supabase/server";
import {
  getPlatformOrgId,
  listStaff,
  listStaffAudit,
} from "@/lib/db/queries/staff";
import { ROLES } from "@/lib/auth/roles";
import { formatDate, formatNumber } from "@/lib/format";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  Stat,
  StatGrid,
} from "@/components/dashboard/primitives";
import { InviteStaffForm } from "@/components/dashboard/invite-staff-form";
import { StaffRow } from "@/components/dashboard/staff-row";

export function generateMetadata() {
  return pageMetadata((d) => d.admin.staff.title);
}

/**
 * Team & access — PDT's own people.
 *
 * docs/PLATFORM-ADMIN.md calls this "step zero": every account in the system is
 * created by the level above, and without this screen a KAM or warehouse account
 * can only be made by running a script on the server. That means the KAM and
 * warehouse dashboards would ship with nobody able to sign in to them.
 *
 * Staff belong to the PLATFORM organisation, never to a customer company — see
 * lib/db/sql/30-platform-org.sql for why that row exists at all.
 */
export default async function StaffPage() {
  const [dict, locale, user] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSessionUser(),
  ]);

  const t = dict.admin.staff;
  const platformOrgId = await getPlatformOrgId();

  if (!platformOrgId) {
    return (
      <>
        <PageHeader title={t.title} lead={t.lead} />
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-5 py-4">
          <p className="font-semibold text-ink-900">{t.noPlatformOrgTitle}</p>
          <p className="mt-1 text-sm text-ink-700">{t.noPlatformOrgBody}</p>
        </div>
      </>
    );
  }

  const [staff, audit] = await Promise.all([listStaff(), listStaffAudit()]);

  const activeAdmins = staff.filter(
    (s) => s.role === ROLES.ADMIN && s.isActive,
  );
  const pending = staff.filter((s) => s.status === "invited");
  const inactive = staff.filter((s) => s.status === "deactivated");

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      <StatGrid>
        <Stat label={t.kpiTotal} value={formatNumber(locale, staff.length)} />
        <Stat
          label={t.kpiAdmins}
          value={formatNumber(locale, activeAdmins.length)}
          tone={activeAdmins.length <= 1 ? "warning" : "default"}
        />
        <Stat
          label={t.kpiPending}
          value={formatNumber(locale, pending.length)}
          sub={t.kpiPendingSub}
        />
        <Stat
          label={t.kpiInactive}
          value={formatNumber(locale, inactive.length)}
        />
      </StatGrid>

      <SectionCard
        title={t.inviteTitle}
        lead={t.inviteLead}
        className="mt-6"
      >
        <InviteStaffForm dict={t} locale={locale} />
      </SectionCard>

      <section className="mt-6 rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-[15px] font-semibold text-ink-900">
            {t.listTitle}
          </h2>
        </div>

        {staff.length === 0 ? (
          <div className="px-5 py-6">
            <EmptyState>{t.empty}</EmptyState>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {staff.map((s) => (
              <StaffRow
                key={s.memberId}
                dict={t}
                locale={locale}
                staff={{
                  memberId: s.memberId,
                  email: s.email,
                  fullName: s.fullName,
                  role: s.role,
                  isActive: s.isActive,
                  status: s.status,
                  lastSignInLabel: s.lastSignInAt
                    ? formatDate(locale, s.lastSignInAt)
                    : t.neverSignedIn,
                  isSelf: s.userId === user?.id,
                  // The row disables its own controls when this is the last way
                  // back in. The server checks again — this only saves a click.
                  isLastAdmin:
                    s.role === ROLES.ADMIN &&
                    s.isActive &&
                    activeAdmins.length <= 1,
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <SectionCard
        title={t.auditTitle}
        lead={t.auditLead}
        className="mt-6"
      >
        {audit.length === 0 ? (
          <EmptyState>{t.auditEmpty}</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {audit.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="text-sm text-ink-800">{entry.summary}</span>
                <span className="tabular shrink-0 text-xs text-ink-500">
                  {formatDate(locale, entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <div className="mt-8 rounded-lg border border-border bg-bone-100/60 px-5 py-4">
        <p className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
          {t.whyTitle}
        </p>
        <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-ink-700">
          {t.whyBody}
        </p>
      </div>
    </>
  );
}
