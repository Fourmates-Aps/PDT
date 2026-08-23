import { pageMetadata } from "@/lib/page-metadata";
import { desc, eq } from "drizzle-orm";
import { getDictionary, getLocale } from "@/lib/i18n";
import { db } from "@/lib/db";
import { organisationMembers } from "@/lib/db/schema";
import { ROLES } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/supabase/server";
import { INVITABLE_BY_CUSTOMER_ADMIN } from "@/lib/auth/invites";
import {
  EmptyState,
  PageHeader,
  SectionCard,
} from "@/components/dashboard/primitives";
import {
  ActionForm,
  Field,
  SelectField,
} from "@/components/dashboard/action-form";
import { Badge } from "@/components/ui/badge";
import { inviteEmployeeAction, revokeMemberAction } from "../../actions";

export function generateMetadata() {
  return pageMetadata((d) => d.auth.employees.title);
}

export default async function CustomerEmployeesPage() {
  const [dict, locale, user] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSessionUser(),
  ]);

  const t = dict.auth.employees;
  const organisationId = user?.organisationId;

  if (!organisationId) {
    return (
      <>
        <PageHeader title={t.title} lead={t.lead} />
        <EmptyState>{t.noOrg}</EmptyState>
      </>
    );
  }

  const members = await db
    .select({
      id: organisationMembers.id,
      fullName: organisationMembers.fullName,
      role: organisationMembers.role,
      isActive: organisationMembers.isActive,
    })
    .from(organisationMembers)
    .where(eq(organisationMembers.organisationId, organisationId))
    .orderBy(desc(organisationMembers.createdAt))
    .limit(200);

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SectionCard title={t.listTitle} className="order-2 lg:order-1">
          {members.length === 0 ? (
            <EmptyState>{t.empty}</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900">
                      {m.fullName ?? "—"}
                    </p>
                    <p className="text-sm text-ink-500">
                      {dict.auth.roles[m.role]}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant={m.isActive ? "secondary" : "outline"}>
                      {m.isActive ? t.statusActive : t.statusInvited}
                    </Badge>

                    {!m.isActive ? (
                      <ActionForm
                        action={revokeMemberAction}
                        submitLabel={t.revoke}
                        pendingLabel={t.revoking}
                        variant="quiet"
                      >
                        <input type="hidden" name="locale" value={locale} />
                        <input
                          type="hidden"
                          name="organisationId"
                          value={organisationId}
                        />
                        <input type="hidden" name="memberId" value={m.id} />
                      </ActionForm>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={t.inviteTitle}
          className="order-1 self-start lg:order-2"
        >
          <ActionForm
            action={inviteEmployeeAction}
            submitLabel={t.invite}
            pendingLabel={t.inviting}
          >
            <input type="hidden" name="locale" value={locale} />
            {/* Validated server-side against the caller's own organisation. */}
            <input type="hidden" name="organisationId" value={organisationId} />
            <Field name="email" label={t.email} type="email" required />
            <Field name="fullName" label={t.fullName} />
            <SelectField
              name="role"
              label={t.role}
              defaultValue={ROLES.EMPLOYEE}
              options={INVITABLE_BY_CUSTOMER_ADMIN.map((r) => ({
                value: r,
                label: dict.auth.roles[r],
              }))}
            />
          </ActionForm>
        </SectionCard>
      </div>
    </>
  );
}
