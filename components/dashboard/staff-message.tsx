"use client";

import type { ActionState } from "@/app/[lang]/dashboard/admin/staff-actions";

/**
 * Renders a staff action result.
 *
 * Same contract as the fulfilment and supplier renderers: the Server Action has
 * no locale of its own, so it returns a code plus values and the sentence is
 * looked up here. Kept separate from the others because each action module has
 * its own code union — one shared loose record would let a typo through.
 */
export function StaffMessage({
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
