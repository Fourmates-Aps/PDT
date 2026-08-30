"use client";

import { useActionState } from "react";
import { moveOrderAction } from "@/app/[lang]/dashboard/fulfilment-actions";
import { ActionMessage } from "./action-message";
import { nextStages, dueTone } from "@/lib/production";
import type { BoardColumn } from "@/lib/db/queries/production";
import type { Dictionary } from "@/lib/i18n";

type Dict = Dictionary["admin"]["production"];

/**
 * The production board.
 *
 * Cards move with BUTTONS, not drag-and-drop. The prototype drags, but this
 * board gets used on a phone next to a heat press and by keyboard at a desk;
 * an explicit "move to Pakning" works in both places, is announced to screen
 * readers, and cannot half-drop a card. Drag can be layered on later as an
 * enhancement over the same actions.
 *
 * Dispatch is not offered here. It is an event that needs a scanned parcel
 * number (Q-C2 c), so it belongs to Pak & send — this board links to it and
 * shows the parcel number once it exists.
 */
export function ProductionBoard({
  columns,
  dict,
  locale,
  warehouseHref,
}: {
  columns: BoardColumn[];
  dict: Dict;
  locale: "da" | "en";
  warehouseHref: string;
}) {
  return (
    // One column per stage on a wide screen; a horizontal scroller below that,
    // which is how a kanban stays a kanban on a phone.
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex w-max gap-3 pb-2 xl:w-full">
        {columns.map((column) => (
          <section
            key={column.stage}
            className="flex w-[280px] shrink-0 flex-col rounded-lg border border-border bg-bone-100/60 p-3 xl:w-auto xl:flex-1"
          >
            <header className="flex items-baseline justify-between gap-2 px-1 pb-3">
              <h2 className="text-sm font-semibold text-ink-900">
                {dict.stages[column.stage]}
              </h2>
              <span className="tabular text-xs text-ink-500">
                {column.cards.length}
              </span>
            </header>

            {column.cards.length === 0 ? (
              <p className="px-1 py-4 text-center text-xs text-ink-400">
                {dict.empty}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {column.cards.map((card) => (
                  <li key={card.id}>
                    <Card
                      card={card}
                      dict={dict}
                      locale={locale}
                      warehouseHref={warehouseHref}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function Card({
  card,
  dict,
  locale,
  warehouseHref,
}: {
  card: BoardColumn["cards"][number];
  dict: Dict;
  locale: "da" | "en";
  warehouseHref: string;
}) {
  const [state, formAction, pending] = useActionState(moveOrderAction, null);

  const days = daysUntil(card.dueAt);
  const dispatched = card.dispatchedAt !== null;
  const tone = dueTone(card.status, days, dispatched);
  // "Delivered" cannot be reached before the parcel has gone, and the parcel
  // goes from Pak & send — so it only appears once dispatch has happened.
  const destinations = nextStages(card.status).filter(
    (s) => s !== "delivered" || dispatched,
  );

  return (
    <article
      className={`rounded-md border bg-card p-3 ${
        tone === "late" ? "border-error/40" : "border-border"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="tabular text-sm font-bold text-ink-900">
          {card.orderNumber}
        </p>
        <p className="tabular text-xs text-ink-500">
          {card.units} {dict.units}
        </p>
      </div>

      <p className="mt-0.5 truncate text-xs text-highvis-700">
        {card.customer}
      </p>
      {card.placedBy ? (
        <p className="truncate text-xs text-ink-500">{card.placedBy}</p>
      ) : null}

      {card.needsDecoration ? (
        <p className="mt-2 inline-block rounded-sm bg-highvis-50 px-1.5 py-0.5 text-[10px] font-semibold text-highvis-700">
          {dict.needsDecoration}
        </p>
      ) : null}

      <p
        className={`tabular mt-2 border-t border-border pt-2 text-[11px] ${
          tone === "late"
            ? "font-semibold text-error"
            : tone === "soon"
              ? "font-semibold text-warning"
              : "text-ink-500"
        }`}
      >
        {dict.due}: {formatDate(locale, card.dueAt)}
        {tone === "late"
          ? ` · ${dict.dueLate.replace("{n}", String(Math.abs(days)))}`
          : tone === "soon"
            ? ` · ${days === 0 ? dict.dueToday : dict.dueIn.replace("{n}", String(days))}`
            : ""}
      </p>

      {destinations.length > 0 ? (
        <form action={formAction} className="mt-2.5 flex flex-wrap gap-1.5">
          <input type="hidden" name="orderId" value={card.id} />
          {destinations.map((to) => (
            <button
              key={to}
              type="submit"
              name="to"
              value={to}
              disabled={pending}
              className="rounded-sm border border-bone-300 px-2 py-1 text-[11px] font-semibold text-ink-700 transition-colors hover:border-ink-900 hover:text-ink-900 disabled:opacity-50"
            >
              {pending ? dict.moving : `→ ${dict.stages[to]}`}
            </button>
          ))}
        </form>
      ) : null}

      {dispatched ? (
        <p className="tabular mt-2 text-[11px] font-semibold text-success">
          {dict.dispatched}
          {card.glsParcelNumber ? ` · GLS ${card.glsParcelNumber}` : ""}
        </p>
      ) : card.status !== "delivered" ? (
        <a
          href={warehouseHref}
          className="mt-2 block text-[11px] font-semibold text-ink-500 transition-colors hover:text-ink-900"
        >
          {dict.openWarehouse}
        </a>
      ) : null}

      {state && !state.ok ? (
        <ActionMessage
          state={state}
          messages={dict.messages}
          className="mt-2 text-[11px]"
        />
      ) : null}
    </article>
  );
}

/** Local copies so the board stays a single client module. */
function daysUntil(date: Date, now = new Date()): number {
  const a = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / 86_400_000);
}

function formatDate(locale: "da" | "en", date: Date): string {
  return new Intl.DateTimeFormat(locale === "da" ? "da-DK" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}
