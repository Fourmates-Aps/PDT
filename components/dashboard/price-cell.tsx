"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { setProductPriceAction } from "@/app/[lang]/dashboard/admin/actions";

/**
 * Per-row price override.
 *
 * Deliberately tiny: one number in, one Server Action out. The bulk tools above
 * the table handle everything systematic; this is for the single garment where
 * the customer negotiated something different.
 *
 * The result is shown as a tick or an inline error rather than a toast, because
 * with a hundred rows on screen a floating message does not say WHICH row it
 * belonged to.
 */
export function PriceCell({
  organisationId,
  productId,
  defaultValue,
  saveLabel,
  savingLabel,
  ariaLabel,
}: {
  organisationId: string;
  productId: string;
  defaultValue: string;
  saveLabel: string;
  savingLabel: string;
  ariaLabel: string;
}) {
  const [state, formAction, pending] = useActionState(
    setProductPriceAction,
    null,
  );

  return (
    <form action={formAction} className="flex items-center justify-end gap-1.5">
      <input type="hidden" name="organisationId" value={organisationId} />
      <input type="hidden" name="productId" value={productId} />
      <input
        name="priceDkk"
        inputMode="decimal"
        defaultValue={defaultValue}
        aria-label={ariaLabel}
        className="tabular w-20 rounded-sm border border-bone-300 bg-white px-2 py-1 text-right text-sm text-ink-800 transition-colors hover:border-ink-300 focus:border-ink-900 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-sm border border-bone-300 px-2 py-1 text-xs font-semibold text-ink-700 transition-colors hover:border-ink-900 hover:text-ink-900 disabled:opacity-50"
      >
        {pending ? savingLabel : saveLabel}
      </button>
      {state?.ok ? (
        <Check className="size-4 shrink-0 text-success" aria-label="✓" />
      ) : null}
      {state && !state.ok ? (
        <span role="alert" className="text-xs text-error">
          !
        </span>
      ) : null}
    </form>
  );
}
