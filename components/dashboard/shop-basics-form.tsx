"use client";

import { ActionForm, Field, SelectField } from "./action-form";
import { createCustomerShopAction } from "@/app/[lang]/dashboard/admin/actions";
import type { Dictionary, Locale } from "@/lib/i18n";

/**
 * Step 1 of Opret kundeshop.
 *
 * Everything the shop needs to run is set here rather than left to defaults the
 * customer never sees: how employees see prices, what they may spend, what goes
 * to approval, and the margin floor that constrains the KAM. Getting those
 * wrong is discovered a month later on an invoice.
 */
export function ShopBasicsForm({
  dict,
  locale,
}: {
  dict: Dictionary["admin"]["onboarding"];
  locale: Locale;
}) {
  return (
    <ActionForm
      action={createCustomerShopAction}
      submitLabel={dict.create}
      pendingLabel={dict.creating}
    >
      <input type="hidden" name="locale" value={locale} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field name="name" label={dict.name} required />
        <div>
          <Field name="slug" label={dict.slug} required placeholder="groenpark" />
          <p className="mt-1 text-xs text-ink-500">{dict.slugHint}</p>
        </div>
        <Field name="cvr" label={dict.cvr} />
        <Field name="ean" label={dict.ean} />
        <Field name="contactName" label={dict.contactName} />
        <Field name="contactEmail" label={dict.contactEmail} type="email" />
        <Field name="contactPhone" label={dict.contactPhone} />
        <Field name="addressLine1" label={dict.address} />
        <Field name="zip" label={dict.zip} />
        <Field name="city" label={dict.city} />
        <Field name="paymentTerms" label={dict.paymentTerms} defaultValue="30" />
        <SelectField
          name="displayMode"
          label={dict.displayMode}
          defaultValue="price"
          options={[
            { value: "price", label: dict.displayPrice },
            { value: "points", label: dict.displayPoints },
          ]}
        />
        <Field
          name="allowanceDkk"
          label={dict.allowance}
          defaultValue="1500"
        />
        <Field
          name="approvalLimitDkk"
          label={dict.approvalLimit}
          defaultValue="1000"
        />
        <div>
          <Field
            name="minimumDgPct"
            label={dict.minimumDg}
            defaultValue="35"
          />
          <p className="mt-1 text-xs text-ink-500">{dict.minimumDgHint}</p>
        </div>
      </div>
    </ActionForm>
  );
}
