"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { setMinimumOrderQtyAction } from "@/app/[lang]/dashboard/admin/supplier-actions";
import type { Dictionary } from "@/lib/i18n";

/**
 * The agreed minimum per delivery, editable in place.
 *
 * Seeded at 0 on purpose: no supplier agreement in the material states one, and
 * a number invented to make the pooled-order bar look busy would pool real
 * customer orders against a threshold nobody agreed. 0 reads as "none agreed"
 * and lets everything release immediately.
 */
export function MinimumOrderField({
  supplierId,
  value,
  dict,
}: {
  supplierId: string;
  value: number;
  dict: Dictionary["admin"]["suppliers"];
}) {
  const [state, formAction, pending] = useActionState(
    setMinimumOrderQtyAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="supplierId" value={supplierId} />
      <input
        name="minimumOrderQty"
        inputMode="numeric"
        defaultValue={String(value)}
        aria-label={dict.colMinimum}
        className="tabular w-20 rounded-sm border border-bone-300 bg-white px-2 py-1 text-sm text-ink-800 transition-colors hover:border-ink-300 focus:border-ink-900 focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-sm border border-bone-300 px-2 py-1 text-xs font-semibold text-ink-700 transition-colors hover:border-ink-900 hover:text-ink-900 disabled:opacity-50"
      >
        {pending ? dict.saving : dict.save}
      </button>
      {state?.ok ? (
        <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
      ) : null}
      {value === 0 ? (
        <span className="text-xs text-ink-500">{dict.noMinimum}</span>
      ) : null}
    </form>
  );
}
