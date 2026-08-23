import { pageMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getSessionUser } from "@/lib/supabase/server";
import { listDepartments } from "@/lib/db/queries/customer";
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
import { formatMoney } from "@/lib/format";
import {
  createDepartmentAction,
  deleteDepartmentAction,
} from "../actions";

export function generateMetadata() {
  return pageMetadata((d) => d.cadmin.departments.title);
}

export default async function DepartmentsPage() {
  const [dict, locale, user] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSessionUser(),
  ]);

  const t = dict.cadmin.departments;
  const organisationId = user?.organisationId;

  if (!organisationId) {
    return (
      <>
        <PageHeader title={t.title} lead={t.lead} />
        <EmptyState>{dict.auth.employees.noOrg}</EmptyState>
      </>
    );
  }

  const rows = await listDepartments(organisationId);

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SectionCard title={t.listTitle} className="lg:order-1 order-2">
          {rows.length === 0 ? (
            <EmptyState>{t.empty}</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900">{d.name}</p>
                    <p className="tabular mt-0.5 text-sm text-ink-500">
                      {d.memberCount} {t.members}
                      {d.budgetDkk
                        ? ` · ${formatMoney(locale, d.budgetDkk)} ${
                            d.budgetPeriod === "monthly"
                              ? t.periodMonthly.toLowerCase()
                              : t.periodAnnual.toLowerCase()
                          }`
                        : ""}
                    </p>
                  </div>

                  <ActionForm
                    action={deleteDepartmentAction}
                    submitLabel={t.delete}
                    pendingLabel={t.deleting}
                    variant="quiet"
                  >
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="departmentId" value={d.id} />
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={t.createTitle}
          className="lg:order-2 order-1 self-start"
        >
          <ActionForm
            action={createDepartmentAction}
            submitLabel={dict.cadmin.common.create}
            pendingLabel={dict.cadmin.common.creating}
          >
            <input type="hidden" name="locale" value={locale} />
            <Field name="name" label={t.name} required />
            <Field name="budget" label={t.budget} type="text" placeholder="0" />
            <SelectField
              name="period"
              label={t.period}
              defaultValue="annual"
              options={[
                { value: "annual", label: t.periodAnnual },
                { value: "monthly", label: t.periodMonthly },
              ]}
            />
          </ActionForm>
        </SectionCard>
      </div>
    </>
  );
}
