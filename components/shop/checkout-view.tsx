"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { useCart } from "./cart-provider";
import {
  placeOrder,
  priceCart,
  type CartSummary,
} from "@/app/[lang]/(shop)/actions";
import type { Dictionary, Locale } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";

type Placed = { orderNumber: string; needsApproval: boolean };

export function CheckoutView({
  dict,
  locale,
}: {
  dict: Dictionary["shop"];
  locale: Locale;
}) {
  const { items, ready, clear } = useCart();
  const [summary, setSummary] = useState<CartSummary | null>(null);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const t = dict.checkout;

  const money = new Intl.NumberFormat(locale === "da" ? "da-DK" : "en-GB", {
    maximumFractionDigits: 0,
  });
  const kr = (n: number | string) => `${money.format(Number(n))} kr.`;

  useEffect(() => {
    if (!ready || placed) return;
    startLoading(async () => {
      const result = await priceCart(items);
      if (result.ok) setSummary(result);
      else setError(result.message);
    });
  }, [items, ready, placed]);

  function onPlace() {
    setError(null);
    startSubmit(async () => {
      const result = await placeOrder(items);
      if (result.ok) {
        setPlaced({
          orderNumber: result.orderNumber,
          needsApproval: result.needsApproval,
        });
        clear();
      } else {
        setError(
          result.message === "personalBlocked" ? t.personalBlocked : t.failed,
        );
      }
    });
  }

  if (placed) {
    return (
      <div className="mx-auto max-w-[520px] rounded-lg border border-border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <h2 className="mt-4 text-h3 font-display font-semibold text-ink-900">
          {t.successTitle}
        </h2>
        <p className="mt-2 text-[15px] text-ink-500">
          {placed.needsApproval ? t.successPending : t.successPlaced}
        </p>
        <p className="tabular mt-4 font-semibold text-ink-900">
          {placed.orderNumber}
        </p>
        <Link
          href={`/${locale}/orders/${placed.orderNumber}`}
          className="mt-6 inline-block rounded-md bg-ink-900 px-6 py-3 text-sm font-semibold text-bone-50 transition-colors hover:bg-ink-700"
        >
          {t.viewOrder}
        </Link>
      </div>
    );
  }

  if (!ready || (!summary && loading)) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!summary || summary.lines.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-6 py-14 text-center">
        <p className="text-ink-500">{t.emptyCart}</p>
        <Link
          href={`/${locale}/shop`}
          className="mt-5 inline-block rounded-md bg-ink-900 px-5 py-2.5 text-sm font-semibold text-bone-50 transition-colors hover:bg-ink-700"
        >
          {dict.cart.emptyCta}
        </Link>
      </div>
    );
  }

  const blocked = summary.personalBlocked;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="font-semibold text-ink-900">{t.summary}</h2>
        <ul className="mt-4 divide-y divide-border">
          {summary.lines.map((l) => (
            <li key={l.variantId} className="flex justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-900">
                  {l.productName}
                </p>
                <p className="tabular text-xs text-ink-500">
                  {[l.colourName, l.size].filter(Boolean).join(" · ")} · {l.qty} ×{" "}
                  {kr(l.unitPrice)}
                </p>
              </div>
              <span className="tabular shrink-0 text-sm font-semibold text-ink-900">
                {kr(l.lineTotal)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <aside className="flex flex-col gap-4">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-semibold text-ink-900">{t.allowanceTitle}</h2>
          {summary.hasQuota ? (
            <dl className="mt-3 space-y-2 text-sm">
              <Row label={t.allowance} value={kr(summary.allowance)} />
              <Row label={t.spent} value={kr(summary.used)} />
              <Row
                label={t.remaining}
                value={kr(summary.remaining)}
                strong
              />
            </dl>
          ) : (
            <p className="mt-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm text-ink-800">
              {t.noQuota}
            </p>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-semibold text-ink-900">{t.splitTitle}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label={t.onAccount} value={kr(summary.onAccount)} />
            {summary.personal > 0 ? (
              <Row
                label={t.personal}
                value={kr(summary.personal)}
                note={t.personalPending}
              />
            ) : null}
            <div className="border-t border-border pt-2">
              <Row label={t.total} value={kr(summary.total)} strong />
            </div>
          </dl>

          {summary.personal > 0 ? (
            <p className="mt-3 text-xs leading-relaxed text-ink-500">
              {t.personalNote}
            </p>
          ) : null}

          {summary.needsApproval ? (
            <p className="mt-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5 text-xs text-ink-800">
              {t.capNote.replace("{limit}", kr(summary.approvalLimit))}
            </p>
          ) : null}

          {blocked ? (
            <p role="alert" className="mt-3 rounded-md border border-error/30 bg-error/5 px-3 py-2.5 text-xs text-error">
              {t.personalBlocked}
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="mt-3 rounded-md border border-error/30 bg-error/5 px-3 py-2.5 text-sm text-error">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={onPlace}
            disabled={submitting || blocked}
            className="mt-5 w-full rounded-md bg-ink-900 px-6 py-3.5 text-[15px] font-semibold text-bone-50 transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? t.placing : t.place}
          </button>
        </section>
      </aside>
    </div>
  );
}

function Row({
  label,
  value,
  note,
  strong = false,
}: {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-500">
        {label}
        {note ? (
          <span className="ml-1.5 text-xs text-warning">({note})</span>
        ) : null}
      </dt>
      <dd
        className={`tabular ${strong ? "text-base font-bold text-ink-900" : "font-semibold text-ink-800"}`}
      >
        {value}
      </dd>
    </div>
  );
}
