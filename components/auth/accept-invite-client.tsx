"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary, Locale } from "@/lib/i18n";
import { AcceptInviteForm } from "./accept-invite-form";

type Status =
  | { phase: "checking" }
  | { phase: "ready"; email: string | null }
  | { phase: "invalid"; detail?: string };

/**
 * The fragment is read ONCE per page load and cached here.
 *
 * It has to survive a second read, because the effect below runs twice in
 * development (React Strict Mode) and again on any remount. The first pass
 * consumes the hash and clears the address bar; without this cache the second
 * pass would see an empty fragment, fall through to the "no tokens" branch and
 * overwrite a correct result — which is exactly how an expired invite ended up
 * rendering the password form instead of the error.
 */
let cachedFragment: URLSearchParams | undefined;

function takeFragment(): URLSearchParams {
  if (cachedFragment) return cachedFragment;

  const raw = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : "";
  cachedFragment = new URLSearchParams(raw);

  // Strip the tokens from the address bar so a live refresh token does not sit
  // in browser history, get copy-pasted out of the URL bar or leak in a Referer.
  if (raw) {
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
  }

  return cachedFragment;
}

/**
 * Turns an invite link into a session, then asks for a password.
 *
 * WHY THIS RUNS ON THE CLIENT
 *
 * The emailed link points at Supabase's own /auth/v1/verify endpoint, which
 * verifies the token and 303s back here with the session in the URL *hash*:
 *
 *   /da/accept-invite#access_token=…&refresh_token=…&type=invite
 *
 * Browsers never send a hash fragment to the server, so no Server Component,
 * Route Handler or proxy can read it — the session simply does not exist
 * server-side when the page renders. Only script on the page can pick the
 * tokens up, which is what this component does. `setSession` hands them to
 * `createBrowserClient`, which writes them to cookies, and from that moment on
 * the Server Action in ./actions.ts sees an authenticated user like any other
 * request.
 *
 * The tokens are stripped from the address bar as soon as they are read — see
 * `takeFragment` above.
 */
export function AcceptInviteClient({
  dict,
  locale,
}: {
  dict: Dictionary["auth"]["accept"];
  locale: Locale;
}) {
  const [status, setStatus] = useState<Status>({ phase: "checking" });

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function run() {
      const params = takeFragment();

      // Supabase reports an unusable link the same way it reports a good one:
      // in the fragment. Expired invites arrive as error=access_denied.
      const error = params.get("error_description") ?? params.get("error");
      if (error) {
        if (!cancelled) setStatus({ phase: "invalid", detail: error });
        return;
      }

      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (cancelled) return;
        if (sessionError || !data.user) {
          setStatus({ phase: "invalid", detail: sessionError?.message });
          return;
        }
        setStatus({ phase: "ready", email: data.user.email ?? null });
        return;
      }

      // No fragment: either the page was reloaded after the tokens were already
      // consumed (cookies are set, carry on) or somebody opened the URL by hand.
      const { data, error: userError } = await supabase.auth.getUser();
      if (cancelled) return;
      if (userError || !data.user) {
        setStatus({ phase: "invalid" });
        return;
      }
      setStatus({ phase: "ready", email: data.user.email ?? null });
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status.phase === "checking") {
    return (
      <p className="mt-8 text-[15px] text-ink-500" role="status">
        {dict.validating}
      </p>
    );
  }

  if (status.phase === "invalid") {
    return (
      <div className="mt-8">
        <p
          role="alert"
          className="rounded-md border border-error/30 bg-error/5 px-4 py-3 text-sm text-error"
        >
          {dict.invalidLink}
        </p>
        <Link
          href={`/${locale}/login`}
          className="mt-6 inline-block text-sm font-semibold text-ink-900 underline underline-offset-4 hover:text-highvis-700"
        >
          {dict.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <>
      {status.email ? (
        <p className="mt-1 text-sm text-ink-500">{status.email}</p>
      ) : null}
      <AcceptInviteForm dict={dict} locale={locale} />
    </>
  );
}
