"use client";

import type { ActionState } from "@/app/[lang]/dashboard/admin/supplier-actions";

/**
 * Renders a supplier action result.
 *
 * Same contract as ActionMessage for fulfilment: the action returns a code and
 * values, the sentence is looked up in the caller's dictionary. Kept as its own
 * component because the two action modules have different code unions, and one
 * shared `Record<string, string>` would let a typo through unnoticed.
 */
export function SupplierMessage({
  state,
  messages,
  className = "",
}: {
  state: ActionState;
  messages: Record<string, string>;
  className?: string;
}) {
  if (!state) return null;

  const template = messages[state.code] ?? messages.generic ?? "";
  const text = Object.entries(state.values ?? {}).reduce(
    (out, [key, value]) => out.replaceAll(`{${key}}`, value),
    template,
  );

  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={`${className} ${state.ok ? "text-success" : "text-error"}`}
    >
      {text}
    </p>
  );
}
