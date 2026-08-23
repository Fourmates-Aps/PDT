"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary, Locale } from "@/lib/i18n";

export function LoginForm({
  dict,
  locale,
  next,
}: {
  dict: Dictionary["auth"]["login"];
  locale: Locale;
  next: string;
}) {
  const id = useId();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // One message for every failure mode. Distinguishing "no such user" from
        // "wrong password" would turn this form into an account-enumeration oracle.
        setError(dict.invalid);
        setPending(false);
        return;
      }

      // Full navigation, not router.push: the session cookie was just set and the
      // Server Components for the destination must be re-rendered with it.
      router.replace(next);
      router.refresh();
    } catch {
      setError(dict.generic);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-8">
      {error ? (
        <div
          role="alert"
          className="mb-5 rounded-md border border-error/30 bg-error/5 px-4 py-3 text-sm text-error"
        >
          {error}
        </div>
      ) : null}

      <div>
        <label
          htmlFor={`${id}-email`}
          className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500"
        >
          {dict.email}
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-2 w-full rounded-sm border border-bone-300 bg-white px-3.5 py-2.5 text-[15px] text-ink-800 transition-colors hover:border-ink-300 focus:border-ink-900 focus:outline-none"
        />
      </div>

      <div className="mt-5">
        <label
          htmlFor={`${id}-password`}
          className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500"
        >
          {dict.password}
        </label>
        <input
          id={`${id}-password`}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 w-full rounded-sm border border-bone-300 bg-white px-3.5 py-2.5 text-[15px] text-ink-800 transition-colors hover:border-ink-300 focus:border-ink-900 focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-7 w-full rounded-md bg-ink-900 px-6 py-3.5 text-[15px] font-semibold text-bone-50 transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? dict.submitting : dict.submit}
      </button>

      <p className="mt-5 text-xs leading-relaxed text-ink-500">
        {dict.needAccount}
      </p>

      <p className="mt-6 border-t border-bone-200 pt-5 text-sm">
        <a href={`/${locale}`} className="text-ink-500 hover:text-ink-900">
          {dict.backToSite}
        </a>
      </p>
    </form>
  );
}
