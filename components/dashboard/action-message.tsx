"use client";

import type { ActionState } from "@/app/[lang]/dashboard/fulfilment-actions";

type Messages = Record<string, string>;

/**
 * Renders a Server Action result that came back as a code.
 *
 * The action has no locale, so it returns `{ code, values }` and the sentence
 * is looked up here — see the comment on FulfilmentCode. An unknown code falls
 * back to the generic message rather than rendering blank, because a silent
 * failure on a dispatch screen is the worst outcome.
 */
export function ActionMessage({
  state,
  messages,
  className = "",
}: {
  state: ActionState;
  messages: Messages;
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
