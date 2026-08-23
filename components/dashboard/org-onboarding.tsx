import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { organisations } from "@/lib/db/schema";
import type { Dictionary, Locale } from "@/lib/i18n";
import { SectionCard } from "@/components/dashboard/primitives";
import {
  ActionForm,
  Field,
  SelectField,
} from "@/components/dashboard/action-form";
import {
  createOrganisationAction,
  inviteOrgAdminAction,
} from "@/app/[lang]/dashboard/actions";

/**
 * Create a customer organisation and invite its administrator.
 *
 * Shared by two routes on purpose: a KAM reaches it at /dashboard/kam/onboarding
 * and platform staff at /dashboard/admin/orgs. Keeping it behind the
 * /dashboard/admin prefix alone locked KAMs out of onboarding customers, which
 * is their job per dev brief §5.6.
 */
export async function OrgOnboarding({
  dict,
  locale,
  showList = true,
}: {
  dict: Dictionary;
  locale: Locale;
  showList?: boolean;
}) {
  const rows = await db
    .select({
      id: organisations.id,
      name: organisations.name,
      slug: organisations.slug,
      cvr: organisations.cvr,
    })
    .from(organisations)
    .orderBy(desc(organisations.createdAt))
    .limit(100);

  const t = dict.auth.orgs;

  return (
    <>
      <SectionCard title={t.createTitle}>
        <ActionForm
          action={createOrganisationAction}
          submitLabel={t.create}
          pendingLabel={t.creating}
        >
          <input type="hidden" name="locale" value={locale} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="name" label={t.name} required />
            <Field
              name="slug"
              label={t.slug}
              required
              placeholder="vognmand-hansen"
            />
            <Field name="cvr" label={t.cvr} />
          </div>
        </ActionForm>
      </SectionCard>

      <SectionCard title={t.inviteTitle} lead={t.inviteLead} className="mt-6">
        {rows.length === 0 ? (
          <p className="text-sm text-ink-500">{t.noOrgsFirst}</p>
        ) : (
          <ActionForm
            action={inviteOrgAdminAction}
            submitLabel={t.invite}
            pendingLabel={t.inviting}
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
      </SectionCard>

      {showList ? (
        <SectionCard title={t.listTitle} className="mt-6">
          {rows.length === 0 ? (
            <p className="text-sm text-ink-500">{t.empty}</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-baseline justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
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
        </SectionCard>
      ) : null}
    </>
  );
}
