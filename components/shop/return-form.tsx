"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n";

export type ReturnableItem = {
  /** Stable value for the select: order number + line id. */
  id: string;
  orderNumber: string;
  label: string;
  orderedOn: string;
};

const REASONS = [
  "tooSmall",
  "tooLarge",
  "regret",
  "defect",
  "wrongItem",
] as const;
const WISHES = ["exchange", "refund", "credit"] as const;

/**
 * Return request form.
 *
 * NOT CONNECTED YET. There is no returns table, no GLS label API and no
 * notification to the customer admin, so submitting shows the employee exactly
 * what they have put together and says plainly that nothing was sent. Building
 * the form first is deliberate — the shape of the request is what the backend
 * has to store — but a screen that pretended to have booked a courier label
 * would be worse than no screen at all.
 *
 * TODO(returns): POST to a `return_requests` table, notify the customer admin,
 * and only then swap the notice below for a real label and tracking number.
 */
export function ReturnForm({
  items,
  dict,
}: {
  items: ReturnableItem[];
  dict: Dictionary["shop"]["returns"];
}) {
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [reason, setReason] = useState<(typeof REASONS)[number]>("tooSmall");
  const [wish, setWish] = useState<(typeof WISHES)[number]>("exchange");
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState(false);

  const item = items.find((i) => i.id === itemId) ?? null;

  const field =
    "mt-2 w-full rounded-sm border border-border bg-bone-50 px-3.5 py-2.5 text-[15px] text-ink-800 transition-colors hover:border-ink-300 focus:border-ink-900 focus:outline-none";
  const legend =
    "font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500";

  if (draft) {
    return (
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="font-semibold text-ink-900">{dict.draftTitle}</h2>

        <dl className="mt-4 divide-y divide-border border-y border-border">
          <Row label={dict.item} value={item?.label ?? "—"} />
          <Row label={dict.reason} value={dict.reasons[reason]} />
          <Row label={dict.wish} value={dict.wishes[wish]} />
          {note.trim() ? <Row label={dict.note} value={note.trim()} /> : null}
        </dl>

        <p
          role="status"
          className="mt-4 rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-ink-800"
        >
          {dict.notLive}
        </p>

        <button
          type="button"
          onClick={() => setDraft(false)}
          className="mt-5 rounded-md border border-ink-900 px-5 py-2.5 text-sm font-semibold text-ink-900 transition-colors hover:bg-ink-900 hover:text-bone-50"
        >
          {dict.startOver}
        </button>
      </section>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setDraft(true);
      }}
      className="rounded-lg border border-border bg-card p-5"
    >
      <h2 className="font-semibold text-ink-900">{dict.startTitle}</h2>

      <label className="mt-5 block">
        <span className={legend}>{dict.item}</span>
        <select
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          className={field}
        >
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.label} ({i.orderNumber})
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 block">
        <span className={legend}>{dict.reason}</span>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as typeof reason)}
          className={field}
        >
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {dict.reasons[r]}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 block">
        <span className={legend}>{dict.wish}</span>
        <select
          value={wish}
          onChange={(e) => setWish(e.target.value as typeof wish)}
          className={field}
        >
          {WISHES.map((w) => (
            <option key={w} value={w}>
              {dict.wishes[w]}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 block">
        <span className={legend}>{dict.note}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className={`${field} resize-y font-body`}
        />
      </label>

      <button
        type="submit"
        className="mt-5 w-full rounded-md bg-ink-900 px-6 py-3 text-sm font-semibold text-bone-50 transition-colors hover:bg-ink-700 sm:w-auto"
      >
        {dict.submit}
      </button>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-3 py-2.5">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="text-sm font-medium text-ink-900">{value}</dd>
    </div>
  );
}
