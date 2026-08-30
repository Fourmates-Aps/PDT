"use client";

import { useId, useState } from "react";
import Image from "next/image";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { EnquiryField, EnquiryResponse } from "@/lib/enquiries";
import { validateEnquiry } from "@/lib/enquiries";
import { Container } from "@/components/landing/section";

/** Their four boxes, in their order. */
const FIELDS: { name: EnquiryField; type: string }[] = [
  { name: "company", type: "text" },
  { name: "name", type: "text" },
  { name: "email", type: "email" },
  { name: "phone", type: "tel" },
];

/**
 * "Har du brug for hjælp?" — the callback strip from the live front page.
 *
 * Four boxes on one line and a SEND button, over a dark band with the headset
 * photograph on the left. That replaces the taller lead form that used to sit
 * here: this asks for four things instead of five and reads as one gesture,
 * which is the point of a callback strip.
 *
 * The labels are visually inside the boxes, as theirs are, but each input still
 * carries a real <label> for screen readers — a placeholder is a hint, not a
 * name, and it disappears the moment somebody types.
 */
export function CallbackStrip({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const id = useId();
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  const [errors, setErrors] = useState<Partial<Record<EnquiryField, true>>>({});

  const t = dict.public.help;
  const labels = dict.public.forms.labels;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {
      ...Object.fromEntries(new FormData(form)),
      kind: "callback",
      locale,
    };

    const { errors: clientErrors } = validateEnquiry(payload);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setStatus("error");
      const first = FIELDS.find((f) => clientErrors[f.name]);
      if (first) document.getElementById(`${id}-${first.name}`)?.focus();
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
        setStatus("done");
        form.reset();
      } else {
        setErrors(result.errors);
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <section id="contact" className="relative isolate overflow-hidden bg-ink-900">
      <Container className="relative grid items-end gap-8 py-12 md:grid-cols-[240px_minmax(0,1fr)] md:gap-10 md:py-0">
        {/* The cut-out sits flush with the bottom of the band, as theirs does. */}
        <div className="hidden self-end md:block">
          <Image
            src="/images/photos/help.webp"
            alt=""
            width={645}
            height={325}
            aria-hidden="true"
            sizes="240px"
            className="h-auto w-[240px]"
          />
        </div>

        <div className="md:py-12">
          <h2 className="text-h2 font-display font-bold text-balance text-bone-50">
            {t.title}
          </h2>
          <p className="mt-2 text-lead italic text-bone-50/70">{t.lead}</p>

          {status === "done" ? (
            <p
              className="mt-6 rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm font-semibold text-bone-50"
              role="status"
            >
              {dict.public.forms.thanksTitle} {dict.public.forms.thanksBody}
            </p>
          ) : (
            <form onSubmit={onSubmit} noValidate className="mt-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {FIELDS.map((field) => {
                  const invalid = errors[field.name] === true;
                  return (
                    <div key={field.name}>
                      <label className="sr-only" htmlFor={`${id}-${field.name}`}>
                        {labels[field.name]}
                      </label>
                      <input
                        id={`${id}-${field.name}`}
                        name={field.name}
                        type={field.type}
                        placeholder={labels[field.name]}
                        aria-invalid={invalid || undefined}
                        className={`w-full rounded-sm border bg-bone-50/10 px-3.5 py-2.5 text-sm text-bone-50 placeholder:text-bone-50/50 focus:outline-none ${
                          invalid
                            ? "border-error"
                            : "border-bone-50/20 focus:border-highvis-400"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Honeypot — off-screen rather than hidden, since some bots skip
                  display:none fields and none of them read a label. */}
              <div className="absolute left-[-9999px]" aria-hidden="true">
                <label htmlFor={`${id}-website`}>
                  {dict.public.forms.leaveEmpty}
                </label>
                <input
                  id={`${id}-website`}
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4">
                <button
                  type="submit"
                  disabled={status === "sending"}
                  className="rounded-sm bg-bone-50 px-7 py-2.5 text-sm font-semibold uppercase tracking-[0.08em] text-ink-900 transition-colors hover:bg-highvis-400 disabled:opacity-50"
                >
                  {status === "sending"
                    ? dict.public.forms.sending
                    : t.submit}
                </button>

                {status === "error" ? (
                  <p className="text-sm text-highvis-400">
                    {Object.keys(errors).length > 0
                      ? t.required
                      : dict.public.forms.failed}
                  </p>
                ) : null}
              </div>

              <p className="mt-3 text-xs text-bone-50/50">
                {dict.public.forms.privacy}
              </p>
            </form>
          )}
        </div>
      </Container>
    </section>
  );
}
