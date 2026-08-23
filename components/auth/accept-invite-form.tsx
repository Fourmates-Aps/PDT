"use client";

import { useActionState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { acceptInviteAction, type AcceptState } from "@/app/[lang]/accept-invite/actions";
import type { Dictionary, Locale } from "@/lib/i18n";

export function AcceptInviteForm({
  dict,
  locale,
}: {
  dict: Dictionary["auth"]["accept"];
  locale: Locale;
}) {
  const id = useId();
  const router = useRouter();
  const [state, formAction, pending] = useActionState<AcceptState, FormData>(
    acceptInviteAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      router.replace(`/${locale}/dashboard`);
      router.refresh();
    }
  }, [state, router, locale]);

  const message =
    state && !state.ok
      ? state.code === "tooShort"
        ? dict.tooShort
        : state.code === "mismatch"
          ? dict.mismatch
          : state.code === "expired"
            ? dict.expired
            : (state.message ?? dict.expired)
      : null;

  return (
    <form action={formAction} className="mt-8">
      {message ? (
        <p
          role="alert"
          className="mb-5 rounded-md border border-error/30 bg-error/5 px-4 py-3 text-sm text-error"
        >
          {message}
        </p>
      ) : null}

      <label htmlFor={`${id}-pw`} className="block">
        <span className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
          {dict.password}
        </span>
        <input
          id={`${id}-pw`}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="mt-2 w-full rounded-sm border border-bone-300 bg-white px-3.5 py-2.5 text-[15px] text-ink-800 transition-colors hover:border-ink-300 focus:border-ink-900 focus:outline-none"
        />
      </label>

      <label htmlFor={`${id}-confirm`} className="mt-5 block">
        <span className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
          {dict.confirm}
        </span>
        <input
          id={`${id}-confirm`}
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="mt-2 w-full rounded-sm border border-bone-300 bg-white px-3.5 py-2.5 text-[15px] text-ink-800 transition-colors hover:border-ink-300 focus:border-ink-900 focus:outline-none"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-7 w-full rounded-md bg-ink-900 px-6 py-3.5 text-[15px] font-semibold text-bone-50 transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? dict.submitting : dict.submit}
      </button>
    </form>
  );
}
