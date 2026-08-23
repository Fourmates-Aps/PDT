import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { getDictionary, getLocale } from "@/lib/i18n";
import { db } from "@/lib/db";
import { organisations } from "@/lib/db/schema";
import { ROLES } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/supabase/server";
import {
  ActionForm,
  Field,
  SelectField,
} from "@/components/dashboard/action-form";
import {
  createOrganisationAction,
  inviteOrgAdminAction,
} from "../../actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminOrgsPage() {
  const [dict, locale, user] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSessionUser(),
  ]);

  // proxy.ts guards this path too; repeated here because the page reads data and
  // must not depend on routing for its authorisation.
  if (!user) redirect(`/${locale}/login`);
  if (user.role !== ROLES.ADMIN && user.role !== ROLES.KEY_ACCOUNT_MANAGER) {
    redirect(`/${locale}/dashboard`);
  }

  const rows = await db
    .select({
      id: organisations.id,
      name: organisations.name,
      slug: organisations.slug,
      cvr: organisations.cvr,
      createdAt: organisations.createdAt,
    })
    .from(organisations)
    .orderBy(desc(organisations.createdAt))
    .limit(100);

  const t = dict.auth.orgs;

  return (
    <main className="mx-auto w-full max-w-[900px] px-5 py-14 sm:px-8">
      <h1 className="text-h1 font-display font-bold text-ink-900">{t.title}</h1>
      <p className="mt-2 max-w-[52ch] text-[15px] text-ink-500">{t.lead}</p>

      <section className="mt-10 rounded-lg border border-bone-200 bg-bone-50 p-6">
        <h2 className="text-h3 font-display font-semibold text-ink-900">
          {t.createTitle}
        </h2>
        <ActionForm
          action={createOrganisationAction}
          submitLabel={t.create}
          pendingLabel={t.creating}
          className="mt-5"
        >
          <input type="hidden" name="locale" value={locale} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="name" label={t.name} required />
            <Field name="slug" label={t.slug} required placeholder="vognmand-hansen" />
            <Field name="cvr" label={t.cvr} />
          </div>
        </ActionForm>
      </section>

      <section className="mt-8 rounded-lg border border-bone-200 bg-bone-50 p-6">
        <h2 className="text-h3 font-display font-semibold text-ink-900">
          {t.inviteTitle}
        </h2>
        <p className="mt-1.5 text-sm text-ink-500">{t.inviteLead}</p>

        {rows.length === 0 ? (
          <p className="mt-5 text-sm text-ink-500">{t.noOrgsFirst}</p>
        ) : (
          <ActionForm
            action={inviteOrgAdminAction}
            submitLabel={t.invite}
            pendingLabel={t.inviting}
            className="mt-5"
          >
            <input type="hidden" name="locale" value={locale} />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                name="organisationId"
                label={t.selectOrg}
                options={rows.map((o) => ({ value: o.id, label: o.name }))}
              />
              <Field name="email" label={t.email} type="email" required />
              <Field name="fullName" label={t.fullName} />
            </div>
          </ActionForm>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-h3 font-display font-semibold text-ink-900">
          {t.listTitle}
        </h2>
        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">{t.empty}</p>
        ) : (
          <ul className="mt-4 divide-y divide-bone-200 border-y border-bone-200">
            {rows.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-baseline justify-between gap-3 py-3.5"
              >
                <span className="font-semibold text-ink-900">{o.name}</span>
                <span className="tabular text-sm text-ink-500">
                  /{o.slug}
                  {o.cvr ? ` · ${o.cvr}` : ""}
                </span>
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
