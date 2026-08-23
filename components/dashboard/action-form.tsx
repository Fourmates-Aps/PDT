"use client";

import { useActionState, type ReactNode } from "react";

/** Structural shape shared by every Server Action in the dashboard. */
export type ActionState = { ok: boolean; message?: string } | null;

type Action = (
  prev: ActionState,
  formData: FormData,
) => Promise<ActionState>;

/**
 * Wraps a Server Action with pending state and a result message.
 *
 * The action does its own authorisation — this component is presentation only,
 * so hiding a form is never what keeps someone out.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  variant = "primary",
  className = "",
}: {
  action: Action;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel: string;
  variant?: "primary" | "quiet";
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className={className}>
      {children}

      {state?.message ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={`mt-4 rounded-md border px-3.5 py-2.5 text-sm ${
            state.ok
              ? "border-success/30 bg-success/5 text-success"
              : "border-error/30 bg-error/5 text-error"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={
          variant === "primary"
            ? "mt-5 rounded-md bg-ink-900 px-5 py-2.5 text-sm font-semibold text-bone-50 transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-60"
            : "rounded-sm border border-bone-300 px-3 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:border-error hover:text-error disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}

export function Field({
  name,
  label,
  type = "text",
  required = false,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="mt-4 block first:mt-0">
      <span className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
        {label}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-2 w-full rounded-sm border border-bone-300 bg-white px-3.5 py-2.5 text-[15px] text-ink-800 transition-colors placeholder:text-ink-300 hover:border-ink-300 focus:border-ink-900 focus:outline-none"
      />
    </label>
  );
}

export function SelectField({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
}) {
  return (
    <label className="mt-4 block first:mt-0">
      <span className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-sm border border-bone-300 bg-white px-3.5 py-2.5 text-[15px] text-ink-800 transition-colors hover:border-ink-300 focus:border-ink-900 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
