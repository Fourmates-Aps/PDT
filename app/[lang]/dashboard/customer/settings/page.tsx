import { pageMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getSessionUser } from "@/lib/supabase/server";
import { getOrganisation } from "@/lib/db/queries/customer";
import {
  EmptyState,
  PageHeader,
  SectionCard,
} from "@/components/dashboard/primitives";
import { ActionForm } from "@/components/dashboard/action-form";
import { toNumber } from "@/lib/format";
import { updateSettingsAction } from "../actions";

export function generateMetadata() {
  return pageMetadata((d) => d.cadmin.settings.title);
}

export default async function SettingsPage() {
  const [dict, locale, user] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSessionUser(),
  ]);

  const t = dict.cadmin.settings;
  const organisationId = user?.organisationId;

  if (!organisationId) {
    return (
      <>
        <PageHeader title={t.title} lead={t.lead} />
        <EmptyState>{dict.auth.employees.noOrg}</EmptyState>
      </>
    );
  }

  const org = await getOrganisation(organisationId);
  const mode = org?.displayMode ?? "price";

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      {/* One form for all settings: these are read together and changed
          together, so a save-per-field would be busywork. */}
      <ActionForm
        action={updateSettingsAction}
        submitLabel={dict.cadmin.common.save}
        pendingLabel={dict.cadmin.common.saving}
        className="flex flex-col gap-6"
      >
        <input type="hidden" name="locale" value={locale} />

        <SectionCard title={t.modeTitle} lead={t.modeLead}>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            {(
              [
                { value: "price", label: t.modePrice },
                { value: "points", label: t.modePoints },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className="flex flex-1 cursor-pointer items-center gap-3 rounded-md border border-border px-4 py-3 text-sm font-medium text-ink-800 transition-colors has-checked:border-ink-900 has-checked:bg-secondary"
              >
                <input
                  type="radio"
                  name="displayMode"
                  value={opt.value}
                  defaultChecked={mode === opt.value}
                  className="size-4 accent-ink-900"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </SectionCard>

        <SectionCard title={t.allowanceTitle} lead={t.allowanceLead}>
          <div className="flex items-center gap-3">
            <input
              name="defaultAllowance"
              type="text"
              inputMode="decimal"
              defaultValue={String(toNumber(org?.defaultAllowanceDkk))}
              aria-label={t.allowanceTitle}
              className="w-40 rounded-sm border border-input bg-white px-3.5 py-2.5 text-[15px] text-ink-800 focus:border-ink-900 focus:outline-none"
            />
            <span className="text-sm text-ink-500">
              {mode === "points"
                ? dict.cadmin.common.points
                : `kr. ${dict.cadmin.common.perYear}`}
            </span>
          </div>
        </SectionCard>

        <SectionCard title={t.limitTitle} lead={t.limitLead}>
          <div className="flex items-center gap-3">
            <input
              name="orderLimit"
              type="text"
              inputMode="decimal"
              defaultValue={String(toNumber(org?.orderApprovalLimitDkk))}
              aria-label={t.limitTitle}
              className="w-40 rounded-sm border border-input bg-white px-3.5 py-2.5 text-[15px] text-ink-800 focus:border-ink-900 focus:outline-none"
            />
            <span className="text-sm text-ink-500">kr.</span>
          </div>
        </SectionCard>

        <SectionCard title={t.personalTitle} lead={t.personalLead}>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-ink-800">
            <input
              type="checkbox"
              name="allowPersonal"
              defaultChecked={org?.allowPersonalPurchases ?? true}
              className="size-4 accent-ink-900"
            />
            {org?.allowPersonalPurchases ? t.personalOn : t.personalOff}
          </label>
        </SectionCard>
      </ActionForm>
    </>
  );
}
