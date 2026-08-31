"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Package, Truck } from "lucide-react";
import {
  dispatchOrderAction,
  moveOrderAction,
} from "@/app/[lang]/dashboard/fulfilment-actions";
import { ActionMessage } from "./action-message";
import { isLogoPlacement, type LogoPlacement } from "@/lib/shop/logo";
import { canDispatch } from "@/lib/production";
import type { PackOrder } from "@/lib/db/queries/production";
import type { Dictionary } from "@/lib/i18n";

type Dict = Dictionary["warehouse"]["packship"];
type PlacementLabels = Record<LogoPlacement, string>;

/**
 * One order in the warehouse queue.
 *
 * The four stages come from D-3: goods are booked with the supplier, ARRIVE,
 * are decorated if the order carries a logo, and are delivered. Dispatch sits
 * across that as an event (Q-C2 c) — scanning the parcel stamps the number and
 * the timestamp without moving the order, so an order can be with GLS and
 * still not be "Leveret".
 *
 * The gate that matters: an order cannot be received until the supplier feed
 * says the goods exist. Booking something in as arrived when the supplier has
 * not shipped it is what makes the rest of the board a guess.
 */
export function PackOrderCard({
  order,
  dict,
  placements,
  locale,
}: {
  order: PackOrder;
  dict: Dict;
  /** Placement names, so the picker reads "Bryst venstre", not "chest_left". */
  placements: PlacementLabels;
  locale: "da" | "en";
}) {
  const [move, moveAction, moving] = useActionState(moveOrderAction, null);
  const [scanning, setScanning] = useState(false);

  const blocked = !order.readyToPick;
  const dispatched = order.dispatchedAt !== null;

  return (
    <article className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <p className="tabular font-bold text-ink-900">{order.orderNumber}</p>
          <p className="truncate text-sm text-ink-500">{order.customer}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {order.needsDecoration ? (
            <span className="rounded-sm bg-highvis-50 px-2 py-0.5 text-[11px] font-semibold text-highvis-700">
              {dict.needsDecoration}
            </span>
          ) : null}
          <span className="tabular text-sm text-ink-500">
            {order.units} {dict.units}
          </span>
        </div>
      </header>

      <div className="px-5 py-4">
        <p className="tabular text-xs text-ink-500">
          {dict.due}: {formatDate(locale, order.dueAt)}
        </p>

        {/* Lines scroll inside their own box on a phone. */}
        <div className="-mx-5 mt-3 overflow-x-auto px-5">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-ink-500">
                <th className="py-2 pr-3 font-medium">{dict.lineProduct}</th>
                <th className="py-2 pr-3 text-right font-medium">
                  {dict.lineQty}
                </th>
                <th className="py-2 font-medium">{dict.lineStock}</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => (
                <tr key={line.id} className="border-t border-border">
                  <td className="py-2.5 pr-3">
                    <span className="block font-medium text-ink-900">
                      {line.productName}
                    </span>
                    <span className="block text-xs text-ink-500">
                      {[line.sku, line.colourName, line.size]
                        .filter(Boolean)
                        .join(" · ")}
                      {line.logoPlacement
                        ? ` · ${describePlacements(line.logoPlacement, placements)}`
                        : ""}
                    </span>
                  </td>
                  <td className="tabular py-2.5 pr-3 text-right font-semibold text-ink-900">
                    {line.quantity}
                  </td>
                  <td className="py-2.5">
                    {line.available ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
                        <Check className="size-3.5" />
                        {dict.inStock}
                      </span>
                    ) : !line.stockTracked ? (
                      /*
                        Three states, not two. A supplier who publishes no stock
                        figures leaves stockQty at 0, and showing "afventer
                        levering (0 stk. på lager)" told the picker something had
                        gone wrong when nothing had — the item is simply bought
                        in for the order.
                      */
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500">
                        <Truck className="size-3.5" />
                        {dict.buyIn}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning">
                        <AlertTriangle className="size-3.5" />
                        {dict.waiting}
                        <span className="tabular font-normal text-ink-500">
                          ({dict.stockCount.replace("{n}", String(line.stockQty))})
                        </span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {blocked && order.status === "booked" ? (
          <p className="mt-4 rounded-md border border-warning/30 bg-warning/5 px-3.5 py-2.5 text-sm text-ink-800">
            {dict.blocked}
          </p>
        ) : null}

        {dispatched ? (
          <p className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-success/30 bg-success/5 px-3.5 py-2.5 text-sm text-success">
            <Truck className="size-4" />
            {dict.dispatched} · GLS {order.glsParcelNumber}
            {order.glsTrackUrl ? (
              <a
                href={order.glsTrackUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline underline-offset-2"
              >
                {dict.track}
              </a>
            ) : null}
          </p>
        ) : null}

        {/* Actions per stage. Each is a plain submit so it works without JS. */}
        <form action={moveAction} className="mt-4 flex flex-wrap gap-2">
          <input type="hidden" name="orderId" value={order.id} />

          {order.status === "booked" ? (
            <Action
              to="arrived_at_warehouse"
              label={dict.toArrived}
              pending={moving}
              pendingLabel={dict.moving}
              disabled={blocked}
            />
          ) : null}

          {order.status === "arrived_at_warehouse" && order.needsDecoration ? (
            <Action
              to="sent_to_print"
              label={dict.toPrint}
              pending={moving}
              pendingLabel={dict.moving}
            />
          ) : null}

          {/*
            * Delivered is the customer holding the parcel, so it only becomes
            * available once one has actually gone — and it is a manual step
            * only until GLS can tell us itself.
            */}
          {dispatched ? (
            <Action
              to="delivered"
              label={dict.markDelivered}
              pending={moving}
              pendingLabel={dict.moving}
            />
          ) : null}

          {order.status === "arrived_at_warehouse" ? (
            <Action
              to="booked"
              label={dict.back}
              pending={moving}
              pendingLabel={dict.moving}
              quiet
            />
          ) : null}

          {order.status === "sent_to_print" ? (
            <Action
              to="arrived_at_warehouse"
              label={dict.back}
              pending={moving}
              pendingLabel={dict.moving}
              quiet
            />
          ) : null}
        </form>

        {canDispatch(order.status) && !dispatched ? (
          <div className="mt-3">
            {scanning ? (
              <ScanForm
                orderId={order.id}
                dict={dict}
                onCancel={() => setScanning(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setScanning(true)}
                className="inline-flex items-center gap-2 rounded-md bg-ink-900 px-5 py-2.5 text-sm font-semibold text-bone-50 transition-colors hover:bg-ink-700"
              >
                <Package className="size-4" />
                {dict.scanTitle}
              </button>
            )}
          </div>
        ) : null}

        <ActionMessage state={move} messages={dict.messages} className="mt-3 text-sm" />
      </div>
    </article>
  );
}

function Action({
  to,
  label,
  pending,
  pendingLabel,
  disabled = false,
  quiet = false,
}: {
  to: string;
  label: string;
  pending: boolean;
  pendingLabel: string;
  disabled?: boolean;
  quiet?: boolean;
}) {
  return (
    <button
      type="submit"
      name="to"
      value={to}
      disabled={pending || disabled}
      className={
        quiet
          ? "rounded-sm border border-bone-300 px-3 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:border-ink-900 hover:text-ink-900 disabled:opacity-50"
          : "rounded-md bg-ink-900 px-5 py-2.5 text-sm font-semibold text-bone-50 transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-50"
      }
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * GLS scan — the dispatch event.
 *
 * The input takes focus on open because a handheld scanner types the code and
 * presses Enter — if focus is anywhere else, the scan lands in nothing and the
 * picker reaches for the keyboard.
 *
 * Submitting does NOT move the order: it records the parcel number and the
 * dispatch time (Q-C2 c), and it is the moment D-5 hangs the invoice on.
 */
function ScanForm({
  orderId,
  dict,
  onCancel,
}: {
  orderId: string;
  dict: Dict;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(dispatchOrderAction, null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <form
      action={formAction}
      className="rounded-md border border-border bg-bone-100/60 p-4"
    >
      <input type="hidden" name="orderId" value={orderId} />

      <p className="text-sm font-semibold text-ink-900">{dict.scanTitle}</p>
      <p className="mt-1 text-xs text-ink-500">{dict.scanLead}</p>

      <label className="mt-3 block">
        <span className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
          {dict.scanLabel}
        </span>
        <input
          ref={inputRef}
          name="parcelNumber"
          autoComplete="off"
          placeholder={dict.scanPlaceholder}
          className="tabular mt-2 w-full rounded-sm border border-bone-300 bg-white px-3.5 py-2.5 text-[15px] text-ink-800 transition-colors placeholder:text-ink-300 hover:border-ink-300 focus:border-ink-900 focus:outline-none"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-ink-900 px-5 py-2.5 text-sm font-semibold text-bone-50 transition-colors hover:bg-ink-700 disabled:opacity-50"
        >
          {pending ? dict.scanning : dict.scanSubmit}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-sm border border-bone-300 px-3 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:border-ink-900"
        >
          {dict.scanCancel}
        </button>
      </div>

      {state && !state.ok ? (
        <ActionMessage
          state={state}
          messages={dict.messages}
          className="mt-3 text-sm"
        />
      ) : null}

      <p className="mt-3 text-xs leading-relaxed text-ink-500">{dict.glsNote}</p>
    </form>
  );
}

/**
 * order_lines.logo_placement stores a comma-joined list of placement ids.
 * Anything unrecognised is passed through rather than dropped — a picker
 * seeing an odd value can ask, but a silently blank logo column cannot.
 */
function describePlacements(raw: string, labels: PlacementLabels): string {
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (isLogoPlacement(p) ? labels[p] : p))
    .join(" · ");
}

function formatDate(locale: "da" | "en", date: Date): string {
  return new Intl.DateTimeFormat(locale === "da" ? "da-DK" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
