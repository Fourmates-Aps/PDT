import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { getDictionary, getLocale } from "@/lib/i18n";
import { db } from "@/lib/db";
import { organisationMembers } from "@/lib/db/schema";
import { ROLES } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/supabase/server";
import { INVITABLE_BY_CUSTOMER_ADMIN } from "@/lib/auth/invites";
import {
  ActionForm,
  Field,
  SelectField,
} from "@/components/dashboard/action-form";
import { inviteEmployeeAction, revokeMemberAction } from "../../actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CustomerEmployeesPage() {
  const [dict, locale, user] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSessionUser(),
  ]);

  if (!user) redirect(`/${locale}/login`);
  if (user.role !== ROLES.CUSTOMER_ADMIN && user.role !== ROLES.ADMIN) {
    redirect(`/${locale}/dashboard`);
  }

  const t = dict.auth.employees;

  if (!user.organisationId) {
    return (
      <main className="mx-auto w-full max-w-[720px] px-5 py-14 sm:px-8">
        <h1 className="text-h1 font-display font-bold text-ink-900">
          {t.title}
        </h1>
        <p className="mt-4 rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-ink-800">
          {t.noOrg}
        </p>
      </main>
    );
  }

  const organisationId = user.organisationId;

  const members = await db
    .select({
      id: organisationMembers.id,
      fullName: organisationMembers.fullName,
      role: organisationMembers.role,
      isActive: organisationMembers.isActive,
      createdAt: organisationMembers.createdAt,
    })
    .from(organisationMembers)
    .where(and(eq(organisationMembers.organisationId, organisationId)))
    .orderBy(desc(organisationMembers.createdAt))
    .limit(200);

  return (
    <main className="mx-auto w-full max-w-[900px] px-5 py-14 sm:px-8">
      <h1 className="text-h1 font-display font-bold text-ink-900">{t.title}</h1>
      <p className="mt-2 max-w-[52ch] text-[15px] text-ink-500">{t.lead}</p>

      <section className="mt-10 rounded-lg border border-bone-200 bg-bone-50 p-6">
        <h2 className="text-h3 font-display font-semibold text-ink-900">
          {t.inviteTitle}
        </h2>
        <ActionForm
          action={inviteEmployeeAction}
          submitLabel={t.invite}
          pendingLabel={t.inviting}
          className="mt-5"
        >
          <input type="hidden" name="locale" value={locale} />
          {/* The action re-derives permission from the session; this value is
              validated against the caller's own organisation, never trusted. */}
          <input type="hidden" name="organisationId" value={organisationId} />
          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>
        </ActionForm>
      </section>

      <section className="mt-8">
        <h2 className="text-h3 font-display font-semibold text-ink-900">
          {t.listTitle}
        </h2>
        {members.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">{t.empty}</p>
        ) : (
          <ul className="mt-4 divide-y divide-bone-200 border-y border-bone-200">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3.5"
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
                  <span
                    className={`rounded-sm px-2 py-1 text-xs font-semibold ${
                      m.isActive
                        ? "bg-success/10 text-success"
                        : "bg-warning/10 text-warning"
                    }`}
                  >
                    {m.isActive ? t.statusActive : t.statusInvited}
                  </span>

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
      </section>

      <p className="mt-10 text-sm">
        <a
          href={`/${locale}/dashboard`}
          className="text-ink-500 hover:text-ink-900"
        >
          ← {dict.auth.dashboard.title}
        </a>
      </p>
    </main>
  );
}
