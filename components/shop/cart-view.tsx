"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "./cart-provider";
import { ProductImage } from "./product-image";
import { priceCart, type CartSummary } from "@/app/[lang]/(shop)/actions";
import type { Dictionary, Locale } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import { describeLogos } from "@/lib/shop/logo";

export function CartView({
  dict,
  locale,
}: {
  dict: Dictionary["shop"];
  locale: Locale;
}) {
  const { items, ready, setQty, remove, removeVariant } = useCart();
  const [summary, setSummary] = useState<CartSummary | null>(null);
  const [pending, startTransition] = useTransition();
  const t = dict.cart;

  const money = new Intl.NumberFormat(locale === "da" ? "da-DK" : "en-GB", {
    maximumFractionDigits: 0,
  });
  // Points mode hides kroner entirely; 1 point maps to 1 DKK.
  const amount = (n: number | string) =>
    summary?.displayMode === "points"
      ? `${money.format(Math.round(Number(n)))} ${dict.allowance.points}`
      : `${money.format(Number(n))} kr.`;

  const logoLabels = {
    placements: dict.logo.placements,
    methods: dict.logo.methods,
  };

  // Every price shown here is computed server-side from org_pricing; the client
  // only ever contributes variant ids and quantities.
  useEffect(() => {
    if (!ready) return;
    startTransition(async () => {
      const result = await priceCart(items);
      if (result.ok) setSummary(result);
    });
  }, [items, ready]);

  // Anything no longer in the assortment is pruned from the stored cart, so the
  // badge count matches what checkout will actually accept.
  useEffect(() => {
    if (!summary?.droppedVariantIds.length) return;
    for (const id of summary.droppedVariantIds) removeVariant(id);
  }, [summary, removeVariant]);

  if (!ready || (!summary && pending)) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!summary || summary.lines.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-6 py-14 text-center">
        <p className="text-ink-500">{t.empty}</p>
        <Link
          href={`/${locale}/shop`}
          className="mt-5 inline-block rounded-md bg-ink-900 px-5 py-2.5 text-sm font-semibold text-bone-50 transition-colors hover:bg-ink-700"
        >
          {t.emptyCta}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <ul className="flex flex-col gap-3">
        {summary.lines.map((l) => (
          <li
            key={l.lineKey}
            className="flex gap-4 rounded-lg border border-border bg-card p-3 sm:p-4"
          >
            <Link
              href={`/${locale}/shop/${l.slug}`}
              className="size-20 shrink-0 overflow-hidden rounded-md bg-bone-100 sm:size-24"
            >
              <ProductImage
                src={l.image}
                alt={l.productName}
                className="size-full object-contain"
              />
            </Link>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/${locale}/shop/${l.slug}`}
                    className="text-sm font-semibold text-ink-900 hover:text-highvis-700"
                  >
                    {l.productName}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {[l.colourName, l.size].filter(Boolean).join(" · ")}
                  </p>
                  {l.logos.length > 0 ? (
                    <p className="mt-1 text-xs text-highvis-700">
                      {describeLogos(l.logos, logoLabels)}
                      {l.embellishment > 0
                        ? ` · + ${amount(l.embellishment)}`
                        : ""}
                    </p>
                  ) : null}
                  {/*
                    * A shortfall is worth showing while the quantity stepper is
                    * still on screen. Finding out at the checkout button that
                    * one line of eight is short means going back and guessing
                    * which one.
                    */}
                  {l.available === null ? null : l.available <= 0 ? (
                    <p className="mt-1 text-xs font-semibold text-error">
                      {dict.checkout.soldOut}
                    </p>
                  ) : l.available < l.qty ? (
                    <p className="mt-1 text-xs font-semibold text-warning">
                      {dict.checkout.onlyLeft.replace("{n}", String(l.available))}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => remove(l.lineKey)}
                  aria-label={`${t.remove} ${l.productName}`}
                  className="shrink-0 rounded-sm p-1.5 text-ink-400 transition-colors hover:text-error"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                <div className="flex items-center gap-1 rounded-md border border-border">
                  <button
                    type="button"
                    onClick={() => setQty(l.lineKey, l.qty - 1)}
                    aria-label="-"
                    className="flex size-8 items-center justify-center text-ink-700 transition-colors hover:bg-secondary"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="tabular w-8 text-center text-sm font-semibold">
                    {l.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty(l.lineKey, l.qty + 1)}
                    aria-label="+"
                    className="flex size-8 items-center justify-center text-ink-700 transition-colors hover:bg-secondary"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>

                <span className="tabular text-sm font-bold text-ink-900">
                  {amount(l.lineTotal)}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="rounded-lg border border-border bg-card p-5 lg:sticky lg:top-24">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold text-ink-900">{t.subtotal}</span>
          <span className="tabular text-xl font-bold text-ink-900">
            {amount(summary.total)}
          </span>
        </div>

        {summary.co2Total > 0 ? (
          <div className="mt-4 rounded-md border border-success/25 bg-success/5 px-3 py-2.5">
            <p className="tabular text-sm font-semibold text-success">
              {t.co2Total}: {summary.co2Total.toFixed(1).replace(".", ",")} kg CO₂e
            </p>
            {summary.co2Partial ? (
              <p className="mt-1 text-xs text-ink-500">{t.co2Partial}</p>
            ) : null}
          </div>
        ) : null}

        <Link
          href={`/${locale}/checkout`}
          className="mt-5 block rounded-md bg-ink-900 px-6 py-3.5 text-center text-[15px] font-semibold text-bone-50 transition-colors hover:bg-ink-700"
        >
          {t.checkout}
        </Link>
        <Link
          href={`/${locale}/shop`}
          className="mt-3 block text-center text-sm text-ink-500 transition-colors hover:text-ink-900"
        >
          {t.keepShopping}
        </Link>
      </aside>
    </div>
  );
}
