import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDictionary, getLocale } from "@/lib/i18n";
import { db } from "@/lib/db";
import { organisations } from "@/lib/db/schema";
import { ROLES } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/supabase/server";
import { customerNav } from "@/components/dashboard/nav-items";
import {
  DashboardMobileNav,
  DashboardSidebar,
} from "@/components/dashboard/dashboard-nav";
import { UserMenu } from "@/components/dashboard/user-menu";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Shell for the kunde-admin area.
 *
 * Mobile-first: the sidebar does not exist below `lg`, where navigation lives in
 * a slide-over instead. Content is a single column until there is room for more.
 */
export default async function CustomerDashboardLayout({
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
  if (user.role !== ROLES.CUSTOMER_ADMIN && user.role !== ROLES.ADMIN) {
    redirect(`/${locale}/dashboard`);
  }

  let orgName = "—";
  if (user.organisationId) {
    const [org] = await db
      .select({ name: organisations.name })
      .from(organisations)
      .where(eq(organisations.id, user.organisationId))
      .limit(1);
    if (org) orgName = org.name;
  }

  const groups = customerNav(dict, locale);

  return (
    <div className="min-h-screen bg-bone-100">
      <DashboardSidebar groups={groups} orgName={orgName} />

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-bone-50/95 px-4 backdrop-blur-sm sm:px-6">
          <DashboardMobileNav
            groups={groups}
            orgName={orgName}
            openLabel={dict.cadmin.nav.openMenu}
          />

          <div className="min-w-0 lg:hidden">
            <p className="truncate font-display text-sm font-bold text-ink-900">
              {orgName}
            </p>
          </div>

          <div className="ml-auto">
            <UserMenu
              email={user.email ?? "—"}
              roleLabel={user.role ? dict.auth.roles[user.role] : "—"}
              accountLabel={dict.cadmin.nav.account}
              signOutLabel={dict.cadmin.nav.signOut}
              locale={locale}
            />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
