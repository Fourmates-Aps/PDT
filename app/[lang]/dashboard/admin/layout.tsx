import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDictionary, getLocale } from "@/lib/i18n";
import { ROLES } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/supabase/server";
import { adminNav } from "@/components/dashboard/nav-items";
import {
  DashboardMobileNav,
  DashboardSidebar,
} from "@/components/dashboard/dashboard-nav";
import { UserMenu } from "@/components/dashboard/user-menu";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Shell for the internal PDT console (`ROLE='pdt'` in the prototype).
 *
 * Platform admins only. KAMs onboard customers at /dashboard/kam/onboarding
 * instead — everything under this prefix touches pricing, margin floors and
 * other customers' agreements, which is not a KAM's to change.
 *
 * The role check here is convenience, not security: proxy.ts guards the prefix
 * and every Server Action re-checks the caller.
 */
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dict, locale, user] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSessionUser(),
  ]);

  if (!user) redirect(`/${locale}/login`);
  if (user.role !== ROLES.ADMIN) redirect(`/${locale}/dashboard`);

  const groups = adminNav(dict, locale);
  const t = dict.admin.nav;

  return (
    <div className="min-h-screen bg-bone-100">
      <DashboardSidebar groups={groups} orgName="Profil Design Trading" />

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-bone-50/95 px-4 backdrop-blur-sm sm:px-6">
          <DashboardMobileNav
            groups={groups}
            orgName="Profil Design Trading"
            openLabel={t.openMenu}
          />

          <div className="min-w-0 lg:hidden">
            <p className="truncate font-display text-sm font-bold text-ink-900">
              Profil Design Trading
            </p>
          </div>

          <div className="ml-auto">
            <UserMenu
              email={user.email ?? "—"}
              roleLabel={user.role ? dict.auth.roles[user.role] : "—"}
              accountLabel={t.account}
              signOutLabel={t.signOut}
              locale={locale}
            />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1240px] px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
