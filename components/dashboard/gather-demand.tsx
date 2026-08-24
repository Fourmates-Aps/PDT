"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { gatherDemandAction } from "@/app/[lang]/dashboard/admin/supplier-actions";
import { SupplierMessage } from "./supplier-message";
import type { Dictionary } from "@/lib/i18n";

/**
 * Pools uncovered customer demand into the suppliers' open orders.
 *
 * A button rather than an automatic hook on checkout: an admin sees the
 * uncovered demand listed below before pressing it, and a purchase basket that
 * fills itself while nobody is watching is one nobody trusts.
 */
export function GatherDemand({
  dict,
}: {
  dict: Dictionary["admin"]["supplierOrders"];
}) {
  const [state, formAction, pending] = useActionState(gatherDemandAction, null);

  return (
    <form action={formAction} className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-[62ch] text-sm text-ink-500">{dict.gatherHint}</p>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-ink-900 px-5 py-2.5 text-sm font-semibold text-bone-50 transition-colors hover:bg-ink-700 disabled:opacity-60"
        >
          <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
          {pending ? dict.gathering : dict.gather}
        </button>
      </div>

      <SupplierMessage
        state={state}
        messages={dict.messages}
        className="mt-3 text-sm"
      />
    </form>
  );
}
