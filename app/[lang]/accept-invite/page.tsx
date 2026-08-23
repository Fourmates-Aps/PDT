import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/lib/i18n";
import { AcceptInviteClient } from "@/components/auth/accept-invite-client";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Where an invite link lands.
 *
 * There is deliberately NO server-side session check here. Supabase returns the
 * session in the URL hash, which never reaches the server, so `getSessionUser()`
 * is empty on this first render for every legitimate invitee — gating on it
 * bounced all of them to /login. The client component below reads the fragment,
 * establishes the session and only then shows the password form.
 */
export default async function AcceptInvitePage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.auth.accept;

  return (
    <main className="flex min-h-screen items-center justify-center bg-bone-100 px-5 py-16">
      <div className="w-full max-w-[420px] rounded-lg border border-bone-200 bg-bone-50 p-8">
        <p className="font-display text-[9px] font-semibold uppercase tracking-[0.24em] text-highvis-700">
          Profil Design Trading
        </p>
        <h1 className="mt-4 text-h2 font-display font-semibold text-ink-900">
          {t.title}
        </h1>
        <p className="mt-2 text-[15px] text-ink-500">{t.lead}</p>

        <AcceptInviteClient dict={t} locale={locale} />
      </div>
    </main>
  );
}
