"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useCart } from "./cart-provider";
import { ProductImage } from "./product-image";
import {
  isLogoMethod,
  isLogoPlacement,
  type CartLogo,
} from "@/lib/shop/logo";
import type { ReorderLine } from "@/lib/db/queries/shop";
import type { Dictionary } from "@/lib/i18n";

/**
 * One-tap reordering of the last order.
 *
 * Most employee orders are a repeat of the last one in the same size, so this
 * sits above the range rather than being buried in order history.
 *
 * Availability is decided on the server (see getLastOrderForReorder) — a line
 * whose variant has left the assortment is shown greyed out rather than added
 * to a cart that would only drop it again at pricing.
 */
export function ReorderStrip({
  orderNumber,
  lines,
  dict,
}: {
  orderNumber: string;
  lines: ReorderLine[];
  dict: Dictionary["shop"]["reorder"];
}) {
  const { add } = useCart();
  const [added, setAdded] = useState<string | null>(null);

  const available = lines.filter((l) => l.available);
  if (lines.length === 0) return null;

  function flash(key: string) {
    setAdded(key);
    window.setTimeout(() => setAdded((k) => (k === key ? null : k)), 2000);
  }

  function addLine(line: ReorderLine) {
    if (!line.available) return;
    add(line.variantId, line.qty, logosOf(line));
    flash(line.variantId);
  }

  function addAll() {
    for (const line of available) add(line.variantId, line.qty, logosOf(line));
    flash("__all__");
  }

  return (
    <section className="mb-8 rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink-900">{dict.title}</h2>
          <p className="mt-0.5 text-xs text-ink-500">
            {dict.lead.replace("{order}", orderNumber)}
          </p>
        </div>
        {available.length > 0 ? (
          <button
            type="button"
            onClick={addAll}
            className="inline-flex items-center gap-2 rounded-md border border-ink-900 px-3.5 py-2 text-sm font-semibold text-ink-900 transition-colors hover:bg-ink-900 hover:text-bone-50"
          >
            <RotateCcw className="size-3.5" />
            {added === "__all__" ? dict.added : dict.all}
          </button>
        ) : null}
      </div>

      {/* Scrolls sideways on a phone instead of wrapping into a wall of chips. */}
      <div className="-mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2">
          {lines.map((line) => {
            const on = added === line.variantId;
            return (
              <li key={`${line.variantId}-${line.size ?? ""}`}>
                <button
                  type="button"
                  onClick={() => addLine(line)}
                  disabled={!line.available}
                  title={line.available ? undefined : dict.unavailable}
                  className={`flex items-center gap-2.5 rounded-full border py-1.5 pr-4 pl-1.5 text-sm transition-colors ${
                    on
                      ? "border-success bg-success/10 text-ink-900"
                      : "border-border text-ink-800 hover:border-ink-900"
                  } ${line.available ? "" : "cursor-not-allowed opacity-45"}`}
                >
                  <span className="size-8 shrink-0 overflow-hidden rounded-full bg-bone-100">
                    <ProductImage
                      src={line.image}
                      alt={line.productName}
                      className="size-full object-contain"
                    />
                  </span>
                  <span className="whitespace-nowrap">
                    {line.productName}
                    {line.size ? (
                      <span className="text-ink-500"> · {line.size}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/**
 * Rebuilds the logo choice stored on the order line.
 *
 * order_lines keeps the placements in one column and a single method, so a line
 * decorated two ways reorders with that one method applied to both placements.
 * Good enough to repeat an order; the proof step is where it gets confirmed.
 */
function logosOf(line: ReorderLine): CartLogo[] | undefined {
  if (!line.logoPlacement || !isLogoMethod(line.logoMethod)) return undefined;
  const logos = line.logoPlacement
    .split(",")
    .map((p) => p.trim())
    .filter(isLogoPlacement)
    .map((placement) => ({ placement, method: line.logoMethod as "embroidery" | "print" }));
  return logos.length ? logos : undefined;
}
