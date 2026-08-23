import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getSessionUser } from "@/lib/supabase/server";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Where an invite link lands, after /auth/callback has exchanged the code for a
 * session. Reaching this page already means the invite token was valid — the
 * form only sets a password.
 */
export default async function AcceptInvitePage() {
  const [dict, locale, user] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSessionUser(),
  ]);

  // No session means the link was never valid, has expired, or was already used.
  if (!user) redirect(`/${locale}/login`);

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
        <p className="mt-1 text-sm text-ink-500">{user.email}</p>

        <AcceptInviteForm dict={t} locale={locale} />
      </div>
    </main>
  );
}
