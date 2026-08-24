"use client";

import { ActionForm, Field } from "./action-form";
import {
  applyMarkupAction,
  applyUpliftAction,
  setMinimumDgAction,
  suggestMarkupAction,
} from "@/app/[lang]/dashboard/admin/actions";
import type { Dictionary } from "@/lib/i18n";

/**
 * The bulk pricing controls (the prototype's toolbar above the catalogue grid).
 *
 * Every action carries the CURRENT FILTER as hidden fields, so "set 45 %" means
 * the brand and category on screen. Writing the whole catalogue when the user
 * was looking at one brand is the kind of surprise that costs a customer money.
 *
 * Without a customer selected the whole panel is inert: there is no such thing
 * as an agreed price with nobody.
 */
export function PricingTools({
  dict,
  organisationId,
  brand,
  category,
  minimumDgPct,
  scopeLabel,
}: {
  dict: Dictionary["admin"]["pricing"];
  organisationId: string | null;
  brand: string | null;
  category: string | null;
  minimumDgPct: number;
  scopeLabel: string;
}) {
  if (!organisationId) {
    return (
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="font-semibold text-ink-900">{dict.toolsTitle}</h2>
        <p className="mt-3 rounded-md border border-warning/30 bg-warning/5 px-3.5 py-2.5 text-sm text-ink-800">
          {dict.pickCustomerFirst}
        </p>
      </section>
    );
  }

  const scope = (
    <>
      <input type="hidden" name="organisationId" value={organisationId} />
      {brand ? <input type="hidden" name="brand" value={brand} /> : null}
      {category ? (
        <input type="hidden" name="category" value={category} />
      ) : null}
    </>
  );

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-semibold text-ink-900">{dict.toolsTitle}</h2>
      <p className="mt-1 text-sm text-ink-500">{dict.toolsLead}</p>
      <p className="tabular mt-2 text-xs font-semibold text-highvis-700">
        {dict.scopeNote.replace("{scope}", scopeLabel)}
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="rounded-md border border-border p-4">
          <ActionForm
            action={applyMarkupAction}
            submitLabel={dict.markupApply}
            pendingLabel={dict.markupApplying}
          >
            {scope}
            <Field name="markupPct" label={dict.markup} placeholder="45" />
            <p className="mt-2 text-xs text-ink-500">{dict.markupHint}</p>
          </ActionForm>
        </div>

        <div className="rounded-md border border-border p-4">
          <ActionForm
            action={applyUpliftAction}
            submitLabel={dict.upliftApply}
            pendingLabel={dict.upliftApplying}
          >
            {scope}
            <Field name="upliftPct" label={dict.uplift} placeholder="5" />
            <p className="mt-2 text-xs text-ink-500">{dict.upliftHint}</p>
          </ActionForm>
        </div>

        <div className="rounded-md border border-border p-4">
          <ActionForm
            action={setMinimumDgAction}
            submitLabel={dict.minDgSave}
            pendingLabel={dict.minDgSaving}
          >
            <input type="hidden" name="organisationId" value={organisationId} />
            <Field
              name="minimumDgPct"
              label={dict.minDg}
              defaultValue={String(minimumDgPct)}
            />
            <p className="mt-2 text-xs text-ink-500">{dict.minDgHint}</p>
          </ActionForm>

          <div className="mt-4 border-t border-border pt-4">
            <ActionForm
              action={suggestMarkupAction}
              submitLabel={dict.suggest}
              pendingLabel={dict.suggesting}
              variant="quiet"
            >
              <input
                type="hidden"
                name="organisationId"
                value={organisationId}
              />
            </ActionForm>
          </div>
        </div>
      </div>
    </section>
  );
}
