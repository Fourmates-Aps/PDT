import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getSessionUser } from "@/lib/supabase/server";
import { ROLES } from "@/lib/auth/roles";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return {
    title: `${dict.auth.dashboard.title} — Profil Design Trading`,
    robots: { index: false, follow: false },
  };
}

export default async function DashboardPage() {
  const [dict, locale, user] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSessionUser(),
  ]);

  /*
   * proxy.ts already redirects unauthenticated requests here, but this check is
   * not redundant: the proxy is a routing convenience, and a page that reads user
   * data must establish for itself that there is a user. Guards belong next to
   * the data they protect.
   */
  if (!user) redirect(`/${locale}/login`);

  // Roles with a home of their own go straight there; this page is the fallback
  // for accounts that are signed in but not yet attached to an organisation.
  if (
    (user.role === ROLES.CUSTOMER_ADMIN || user.role === ROLES.ADMIN) &&
    user.organisationId
  ) {
    redirect(`/${locale}/dashboard/customer`);
  }

  const d = dict.auth.dashboard;
  const roleLabel = user.role ? dict.auth.roles[user.role] : null;
  const incomplete = !user.role || !user.organisationId;

  return (
    <main className="mx-auto w-full max-w-[720px] px-5 py-16 sm:px-8">
      <h1 className="text-h1 font-display font-bold text-ink-900">{d.title}</h1>

      {incomplete ? (
        <p className="mt-6 rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-ink-800">
          {d.pendingSetup}
        </p>
      ) : null}

      <dl className="mt-8 divide-y divide-bone-200 border-y border-bone-200">
        <div className="flex justify-between gap-6 py-4">
          <dt className="text-sm text-ink-500">{d.signedInAs}</dt>
          <dd className="text-sm font-semibold text-ink-900">{user.email}</dd>
        </div>
        <div className="flex justify-between gap-6 py-4">
          <dt className="text-sm text-ink-500">{d.role}</dt>
          <dd className="text-sm font-semibold text-ink-900">
            {roleLabel ?? (
              <span className="font-normal text-ink-500">{d.noRole}</span>
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-6 py-4">
          <dt className="text-sm text-ink-500">{d.organisation}</dt>
          <dd className="tabular text-sm font-semibold text-ink-900">
            {user.organisationId ?? (
              <span className="font-normal text-ink-500">{d.noOrg}</span>
            )}
          </dd>
        </div>
      </dl>

      <form action="/auth/signout" method="post" className="mt-8">
        <input type="hidden" name="locale" value={locale} />
        <button
          type="submit"
          className="rounded-md border border-bone-300 px-5 py-2.5 text-sm font-semibold text-ink-800 transition-colors hover:border-ink-900"
        >
          {d.signOut}
        </button>
      </form>
    </main>
  );
}
