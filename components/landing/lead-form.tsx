"use client";

import { useId, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { validateLead, type LeadField, type LeadResponse } from "@/lib/leads";

type Status = "idle" | "sending" | "success" | "error";

const FIELD_ORDER: LeadField[] = ["company", "name", "email", "employees"];

export function LeadForm({
  dict,
  locale,
}: {
  dict: Dictionary["lead"];
  locale: Locale;
}) {
  const id = useId();
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Partial<Record<LeadField, true>>>({});

  const fieldId = (name: string) => `${id}-${name}`;
  const errorId = (name: string) => `${id}-${name}-error`;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));

    // The same validator the route handler runs, so the user gets an instant,
    // localised answer instead of paying a network round trip for a typo.
    const { errors: clientErrors } = validateLead(payload);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setStatus("error");
      document.getElementById(fieldId(FIELD_ORDER.find((f) => clientErrors[f])!))?.focus();
      return;
    }

    setStatus("sending");
    setErrors({});

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as LeadResponse;

      if (result.ok) {
        setStatus("success");
        form.reset();
      } else {
        setErrors(result.errors);
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className="rounded-lg border border-bone-200 bg-bone-50 p-8"
      >
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-md bg-highvis-500 font-display text-lg font-bold text-ink-900"
        >
          ✓
        </span>
        <h3 className="mt-5 text-h3 font-display font-semibold text-ink-900">
          {dict.successTitle}
        </h3>
        <p className="mt-2 text-[15px] text-ink-500">{dict.successBody}</p>
      </div>
    );
  }

  const hasFieldErrors = Object.keys(errors).length > 0;

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="rounded-lg border border-bone-200 bg-bone-50 p-6 sm:p-8"
    >
      {status === "error" ? (
        <div
          role="alert"
          className="mb-6 rounded-md border border-error/30 bg-error/5 px-4 py-3"
        >
          <p className="text-sm font-semibold text-error">{dict.errorTitle}</p>
          {!hasFieldErrors ? (
            <p className="mt-1 text-sm text-ink-500">{dict.errorGeneric}</p>
          ) : null}
        </div>
      ) : null}

      <input type="hidden" name="locale" value={locale} />

      {/* Honeypot. Hidden from sight and from assistive technology; bots fill it in. */}
      <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden">
        <label htmlFor={fieldId("website")}>Website</label>
        <input
          id={fieldId("website")}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id={fieldId("company")}
          errorId={errorId("company")}
          name="company"
          label={dict.fields.company}
          autoComplete="organization"
          invalid={!!errors.company}
          error={dict.errors.company}
        />
        <Field
          id={fieldId("name")}
          errorId={errorId("name")}
          name="name"
          label={dict.fields.name}
          autoComplete="name"
          invalid={!!errors.name}
          error={dict.errors.name}
        />
        <Field
          id={fieldId("email")}
          errorId={errorId("email")}
          name="email"
          type="email"
          label={dict.fields.email}
          autoComplete="email"
          invalid={!!errors.email}
          error={dict.errors.email}
        />
        <Field
          id={fieldId("phone")}
          errorId={errorId("phone")}
          name="phone"
          type="tel"
          label={dict.fields.phone}
          hint={dict.fields.phoneOptional}
          autoComplete="tel"
        />
        <Field
          id={fieldId("employees")}
          errorId={errorId("employees")}
          name="employees"
          type="number"
          inputMode="numeric"
          min={1}
          label={dict.fields.employees}
          invalid={!!errors.employees}
          error={dict.errors.employees}
        />
      </div>

      <div className="mt-5">
        <label
          htmlFor={fieldId("message")}
          className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500"
        >
          {dict.fields.message}
        </label>
        <textarea
          id={fieldId("message")}
          name="message"
          rows={4}
          placeholder={dict.messagePlaceholder}
          className="mt-2 w-full resize-y rounded-sm border border-bone-300 bg-white px-3.5 py-2.5 text-[15px] text-ink-800 transition-colors placeholder:text-ink-300 hover:border-ink-300 focus:border-ink-900 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-6 w-full rounded-md bg-ink-900 px-6 py-3.5 text-[15px] font-semibold text-bone-50 transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {status === "sending" ? dict.sending : dict.submit}
      </button>

      <p className="mt-4 text-xs leading-relaxed text-ink-500">{dict.privacy}</p>
    </form>
  );
}

function Field({
  id,
  errorId,
  name,
  label,
  hint,
  error,
  invalid = false,
  type = "text",
  ...rest
}: {
  id: string;
  errorId: string;
  name: string;
  label: string;
  hint?: string;
  error?: string;
  invalid?: boolean;
  type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label
        htmlFor={id}
        className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500"
      >
        {label}
        {hint ? (
          <span className="ml-1.5 font-body text-[11px] font-normal tracking-normal normal-case text-ink-400">
            ({hint})
          </span>
        ) : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        className={`mt-2 w-full rounded-sm border bg-white px-3.5 py-2.5 text-[15px] text-ink-800 transition-colors placeholder:text-ink-300 focus:outline-none ${
          invalid
            ? "border-error focus:border-error"
            : "border-bone-300 hover:border-ink-300 focus:border-ink-900"
        }`}
        {...rest}
      />
      {invalid && error ? (
        <p id={errorId} className="mt-1.5 text-xs text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
