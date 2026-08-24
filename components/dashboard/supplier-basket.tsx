"use client";

import { useActionState } from "react";
import { releaseBasketAction } from "@/app/[lang]/dashboard/admin/supplier-actions";
import { SupplierMessage } from "./supplier-message";
import type { SupplierBasket } from "@/lib/db/queries/suppliers";
import type { Dictionary } from "@/lib/i18n";

type Dict = Dictionary["admin"]["supplierOrders"];

/**
 * One supplier's pooled order.
 *
 * The bar is the whole idea: a customer needs two jackets, the supplier will
 * not ship fewer than twenty-five, so demand sits here until enough of it
 * accumulates. Release is offered either way, but going below an agreed
 * minimum needs the override ticked — the server enforces the same rule, so
 * this is a signpost rather than the gate.
 */
export function SupplierBasketCard({
  basket,
  dict,
  channelLabel,
  locale,
}: {
  basket: SupplierBasket;
  dict: Dict;
  channelLabel: string;
  locale: "da" | "en";
}) {
  const [state, formAction, pending] = useActionState(
    releaseBasketAction,
    null,
  );

  const hasMinimum = basket.minimumOrderQty > 0;
  const pct = hasMinimum
    ? Math.min(100, Math.round((basket.units / basket.minimumOrderQty) * 100))
    : 100;

  const money = new Intl.NumberFormat(locale === "da" ? "da-DK" : "en-GB", {
    maximumFractionDigits: 0,
  });

  return (
    <article className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <p className="font-semibold text-ink-900">{basket.supplierName}</p>
          <p className="text-xs text-ink-500">
            {channelLabel} · {basket.leadTimeDays} {dict.units === "stk." ? "d" : "d"}
          </p>
        </div>
        <div className="text-right">
          <p className="tabular text-lg font-bold text-ink-900">
            {basket.units} {dict.units}
          </p>
          {basket.valueDkk > 0 ? (
            <p className="tabular text-xs text-ink-500">
              {dict.value} {money.format(basket.valueDkk)} kr.
            </p>
          ) : null}
        </div>
      </header>

      <div className="px-5 py-4">
        {hasMinimum ? (
          <>
            <div
              role="meter"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={dict.progress
                .replace("{units}", String(basket.units))
                .replace("{minimum}", String(basket.minimumOrderQty))}
              className="h-2.5 w-full overflow-hidden rounded-full bg-bone-200"
            >
              <div
                className={`h-full rounded-full transition-[width] ${
                  basket.meetsMinimum ? "bg-success" : "bg-highvis-500"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="tabular mt-2 flex flex-wrap items-center gap-x-2 text-xs">
              <span className="font-semibold text-ink-900">
                {dict.progress
                  .replace("{units}", String(basket.units))
                  .replace("{minimum}", String(basket.minimumOrderQty))}
              </span>
              <span
                className={
                  basket.meetsMinimum ? "text-success" : "text-highvis-700"
                }
              >
                {basket.meetsMinimum ? dict.meets : dict.below}
              </span>
            </p>
          </>
        ) : (
          <p className="text-xs text-ink-500">{dict.noMinimum}</p>
        )}

        {basket.lines.length === 0 ? (
          <p className="mt-4 text-sm text-ink-500">{dict.basketEmpty}</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {basket.lines.map((line) => (
              <li
                key={line.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2"
              >
                <span className="min-w-0">
                  <span className="text-sm text-ink-900">
                    {line.productName}
                  </span>
                  <span className="block text-xs text-ink-500">
                    {[line.colourName, line.size].filter(Boolean).join(" · ")}
                    {line.customer
                      ? ` · ${dict.forCustomer} ${line.customer}${line.orderNumber ? ` (${line.orderNumber})` : ""}`
                      : ` · ${dict.stockBuy}`}
                  </span>
                </span>
                <span className="tabular shrink-0 text-sm font-semibold text-ink-900">
                  {line.quantity} {dict.units}
                </span>
              </li>
            ))}
          </ul>
        )}

        {basket.supplierOrderId && basket.units > 0 ? (
          <form action={formAction} className="mt-4">
            <input
              type="hidden"
              name="supplierOrderId"
              value={basket.supplierOrderId}
            />

            {hasMinimum && !basket.meetsMinimum ? (
              <label className="mb-3 flex items-center gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  name="override"
                  className="size-4 accent-ink-900"
                />
                {dict.override}
              </label>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-ink-900 px-5 py-2.5 text-sm font-semibold text-bone-50 transition-colors hover:bg-ink-700 disabled:opacity-60"
            >
              {pending ? dict.releasing : dict.release}
            </button>
          </form>
        ) : null}

        <SupplierMessage
          state={state}
          messages={dict.messages}
          className="mt-3 text-sm"
        />
      </div>
    </article>
  );
}
