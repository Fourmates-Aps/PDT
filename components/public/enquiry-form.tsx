"use client";

import { useId, useState } from "react";
import {
  REQUIRED,
  validateEnquiry,
  type EnquiryField,
  type EnquiryKind,
  type EnquiryResponse,
} from "@/lib/enquiries";
import type { Dictionary, Locale } from "@/lib/i18n";

type Status = "idle" | "sending" | "success" | "error";

export type FormField = {
  name: EnquiryField;
  /** `select` renders `options`; `textarea` a multi-line box. */
  type?: "text" | "email" | "tel" | "textarea" | "select";
  options?: string[];
  /** Full width in the two-column grid. */
  wide?: boolean;
};

/**
 * The one form behind Kontakt, Ansøg om B2B-login and the newsletter signup.
 *
 * They differ only in which fields they show and which are required, so they
 * share a component, a validator and an endpoint. Three near-identical forms is
 * how the required-field rules drift apart.
 *
 * Not a Server Action: this posts JSON to /api/enquiries so the same validator
 * can run in the browser first and answer a typo without a round trip. The
 * server runs it again regardless.
 */
export function EnquiryForm({
  kind,
  fields,
  dict,
  locale,
  submitLabel,
  className = "",
}: {
  kind: EnquiryKind;
  fields: FormField[];
  dict: Dictionary;
  locale: Locale;
  submitLabel: string;
  className?: string;
}) {
  const id = useId();
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Partial<Record<EnquiryField, true>>>({});

  const t = dict.public.forms;
  const required = REQUIRED[kind];

  const fieldId = (name: string) => `${id}-${name}`;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      ...Object.fromEntries(new FormData(form)),
      kind,
      locale,
    };

    const { errors: clientErrors } = validateEnquiry(payload);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setStatus("error");
      const first = fields.find((f) => clientErrors[f.name]);
      if (first) document.getElementById(fieldId(first.name))?.focus();
      return;
    }

    setStatus("sending");
    setErrors({});

    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as EnquiryResponse;

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
        className={`rounded-lg border border-success/30 bg-success/5 px-5 py-6 ${className}`}
        role="status"
      >
        <p className="font-semibold text-ink-900">{t.thanksTitle}</p>
        <p className="mt-1 text-sm text-ink-700">{t.thanksBody}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={`rounded-lg border border-border bg-card p-5 sm:p-6 ${className}`}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const isRequired = required.includes(field.name);
          const invalid = errors[field.name] === true;
          const label = t.labels[field.name];

          return (
            <div
              key={field.name}
              className={
                field.wide || field.type === "textarea"
                  ? "sm:col-span-2"
                  : undefined
              }
            >
              <label
                htmlFor={fieldId(field.name)}
                className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500"
              >
                {label}
                {isRequired ? (
                  <span className="text-highvis-700" aria-hidden="true">
                    {" *"}
                  </span>
                ) : null}
              </label>

              {field.type === "textarea" ? (
                <textarea
                  id={fieldId(field.name)}
                  name={field.name}
                  rows={5}
                  required={isRequired}
                  aria-invalid={invalid || undefined}
                  className={inputClass(invalid)}
                />
              ) : field.type === "select" ? (
                <select
                  id={fieldId(field.name)}
                  name={field.name}
                  aria-invalid={invalid || undefined}
                  className={inputClass(invalid)}
                  defaultValue=""
                >
                  <option value="">{t.choose}</option>
                  {(field.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={fieldId(field.name)}
                  name={field.name}
                  type={field.type ?? "text"}
                  required={isRequired}
                  autoComplete={AUTOCOMPLETE[field.name]}
                  aria-invalid={invalid || undefined}
                  className={inputClass(invalid)}
                />
              )}

              {invalid ? (
                <p className="mt-1 text-xs font-medium text-error">
                  {t.invalid}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Honeypot. Off-screen rather than display:none — some bots skip hidden
          fields, and none of them read a label. */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label htmlFor={fieldId("website")}>{t.leaveEmpty}</label>
        <input id={fieldId("website")} name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {kind === "application" ? (
        <label className="mt-4 flex items-start gap-2.5 text-sm text-ink-700">
          <input
            type="checkbox"
            name="newsletter"
            className="mt-0.5 size-4 rounded-sm border-bone-300"
          />
          {t.newsletterOptIn}
        </label>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={status === "sending"}
          className="rounded-md bg-ink-900 px-6 py-3 text-[15px] font-semibold text-bone-50 transition-colors hover:bg-ink-700 disabled:opacity-50"
        >
          {status === "sending" ? t.sending : submitLabel}
        </button>
        {status === "error" && Object.keys(errors).length === 0 ? (
          <p className="text-sm text-error">{t.failed}</p>
        ) : null}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink-500">{t.privacy}</p>
    </form>
  );
}

const AUTOCOMPLETE: Partial<Record<EnquiryField, string>> = {
  company: "organization",
  name: "name",
  firstName: "given-name",
  lastName: "family-name",
  address: "street-address",
  zipcode: "postal-code",
  city: "address-level2",
  country: "country-name",
  phone: "tel",
  email: "email",
};

function inputClass(invalid: boolean): string {
  return `mt-1.5 w-full rounded-sm border bg-white px-3.5 py-2.5 text-[15px] text-ink-800 transition-colors placeholder:text-ink-300 focus:outline-none ${
    invalid
      ? "border-error focus:border-error"
      : "border-bone-300 hover:border-ink-300 focus:border-ink-900"
  }`;
}
