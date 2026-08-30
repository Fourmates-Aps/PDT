"use client";

import { useId, useState } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { EnquiryResponse } from "@/lib/enquiries";

/**
 * Nyhedstilmelding — the newsletter signup from the live site's account menu.
 *
 * A single field, so it does not go through EnquiryForm: that component's
 * two-column grid, per-field error slots and honeypot markup would be scaffolding
 * around one input. It posts to the same endpoint with the same honeypot.
 */
export function NewsletterForm({
  newsletter,
  forms,
  locale,
}: {
  newsletter: Dictionary["public"]["newsletter"];
  /* Only the strings this form shows — see EnquiryForm for why. */
  forms: Pick<
    Dictionary["public"]["forms"],
    "thanksTitle" | "sending" | "failed" | "leaveEmpty"
  >;
  locale: Locale;
}) {
  const id = useId();
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );

  const t = newsletter;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      ...Object.fromEntries(new FormData(form)),
      kind: "newsletter",
      newsletter: true,
      locale,
    };

    setStatus("sending");
    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as EnquiryResponse;
      setStatus(result.ok ? "done" : "error");
      if (result.ok) form.reset();
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p className="text-sm text-highvis-400" role="status">
        {forms.thanksTitle}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-3">
      <label className="sr-only" htmlFor={`${id}-email`}>
        {t.placeholder}
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          placeholder={t.placeholder}
          className="min-w-0 flex-1 rounded-sm border border-bone-200/20 bg-bone-50/5 px-3 py-2 text-sm text-bone-50 placeholder:text-ink-300 focus:border-highvis-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="rounded-sm bg-highvis-500 px-4 py-2 text-sm font-semibold text-ink-900 transition-colors hover:bg-highvis-400 disabled:opacity-50"
        >
          {status === "sending" ? forms.sending : t.submit}
        </button>
      </div>

      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label htmlFor={`${id}-website`}>{forms.leaveEmpty}</label>
        <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {status === "error" ? (
        <p className="mt-2 text-xs text-error">{forms.failed}</p>
      ) : null}
    </form>
  );
}
