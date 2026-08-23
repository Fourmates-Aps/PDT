import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getSessionUser } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/login-form";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return {
    title: `${dict.auth.login.title} — Profil Design Trading`,
    // A sign-in page has no business in search results.
    robots: { index: false, follow: false },
  };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [dict, locale, user, params] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSessionUser(),
    searchParams,
  ]);

  /*
   * Only same-origin relative paths are accepted as a redirect target. Taking
   * `next` straight from the query string would let a crafted link bounce a
   * freshly signed-in user to an attacker's site — a classic open redirect.
   */
  const requested = params.next ?? "";
  const next =
    requested.startsWith("/") && !requested.startsWith("//")
      ? requested
      : `/${locale}/dashboard`;

  if (user) redirect(next);

  return (
    <main className="flex min-h-screen items-center justify-center bg-bone-100 px-5 py-16">
      <div className="w-full max-w-[420px] rounded-lg border border-bone-200 bg-bone-50 p-8">
        <p className="font-display text-[9px] font-semibold uppercase tracking-[0.24em] text-highvis-700">
          Profil Design Trading
        </p>
        <h1 className="mt-4 text-h2 font-display font-semibold text-ink-900">
          {dict.auth.login.title}
        </h1>
        <p className="mt-2 text-[15px] text-ink-500">{dict.auth.login.lead}</p>

        <LoginForm dict={dict.auth.login} locale={locale} next={next} />
      </div>
    </main>
  );
}
