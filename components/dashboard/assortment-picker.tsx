"use client";

import { useActionState, useState } from "react";
import { applyAssortmentAction } from "@/app/[lang]/dashboard/admin/actions";
import { ProductImage } from "@/components/shop/product-image";
import type { PricingRow } from "@/lib/db/queries/pricing";
import type { Dictionary } from "@/lib/i18n";

/**
 * Step 2 of Opret kundeshop: which products this customer may order.
 *
 * The form posts a hidden `scopeProductId` for every row on screen alongside
 * the ticked `productId`s. That is what lets the action switch products OFF —
 * an unticked checkbox posts nothing at all, so without the scope the action
 * could only ever add to the range and never remove from it.
 */
export function AssortmentPicker({
  rows,
  organisationId,
  dict,
  defaultMarkup = 45,
}: {
  rows: PricingRow[];
  organisationId: string;
  dict: Dictionary["admin"]["onboarding"];
  defaultMarkup?: number;
}) {
  const [state, formAction, pending] = useActionState(
    applyAssortmentAction,
    null,
  );

  // Controlled so "select everything shown" can drive them; seeded from what
  // the customer already carries.
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(rows.map((r) => [r.productId, r.inAssortment])),
  );

  const selected = rows.filter((r) => checked[r.productId]).length;
  const allOn = selected === rows.length && rows.length > 0;

  function toggleAll() {
    setChecked(
      Object.fromEntries(rows.map((r) => [r.productId, !allOn])),
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="organisationId" value={organisationId} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="min-w-40">
          <span className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
            {dict.markup}
          </span>
          <input
            name="markupPct"
            inputMode="decimal"
            defaultValue={String(defaultMarkup)}
            className="mt-2 w-full rounded-sm border border-bone-300 bg-white px-3.5 py-2.5 text-[15px] text-ink-800 transition-colors hover:border-ink-300 focus:border-ink-900 focus:outline-none"
          />
          <span className="mt-1 block text-xs text-ink-500">
            {dict.markupHint}
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <span className="tabular text-sm text-ink-500">
            {dict.inAssortment.replace("{n}", String(selected))}
          </span>
          <button
            type="button"
            onClick={toggleAll}
            className="rounded-sm border border-bone-300 px-3 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:border-ink-900 hover:text-ink-900"
          >
            {dict.selectAll}
          </button>
        </div>
      </div>

      <ul className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => {
          const on = checked[r.productId] ?? false;
          return (
            <li key={r.productId}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                  on ? "border-ink-900 bg-highvis-50/40" : "border-border"
                }`}
              >
                <input
                  type="checkbox"
                  name="productId"
                  value={r.productId}
                  checked={on}
                  onChange={(e) =>
                    setChecked((c) => ({
                      ...c,
                      [r.productId]: e.target.checked,
                    }))
                  }
                  className="size-4 shrink-0 accent-ink-900"
                />
                <input
                  type="hidden"
                  name="scopeProductId"
                  value={r.productId}
                />
                <span className="size-9 shrink-0 overflow-hidden rounded-sm bg-bone-100">
                  <ProductImage
                    src={r.image}
                    alt={r.name}
                    className="size-full object-contain"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink-900">
                    {r.name}
                  </span>
                  <span className="block truncate text-xs text-ink-500">
                    {r.brand} · {r.category} · {r.variantCount}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {state?.message ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={`mt-5 rounded-md border px-3.5 py-2.5 text-sm ${
            state.ok
              ? "border-success/30 bg-success/5 text-success"
              : "border-error/30 bg-error/5 text-error"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 rounded-md bg-ink-900 px-5 py-2.5 text-sm font-semibold text-bone-50 transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? dict.saving : dict.save}
      </button>
    </form>
  );
}
