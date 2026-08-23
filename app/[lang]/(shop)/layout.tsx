import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDictionary, getLocale } from "@/lib/i18n";
import { db } from "@/lib/db";
import { organisations } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/supabase/server";
import { CartProvider } from "@/components/shop/cart-provider";
import { CartBadge } from "@/components/shop/cart-badge";
import { UserMenu } from "@/components/dashboard/user-menu";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Shell for the employee-facing shop, cart, checkout and order history.
 *
 * Deliberately lighter than the kunde-admin shell: an employee is here to order
 * a jacket, not to administer anything, so there is no sidebar to navigate.
 */
export default async function ShopLayout({
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

  let orgName = "—";
  if (user.organisationId) {
    const [org] = await db
      .select({ name: organisations.name })
      .from(organisations)
      .where(eq(organisations.id, user.organisationId))
      .limit(1);
    if (org) orgName = org.name;
  }

  const t = dict.shop.nav;
  const base = `/${locale}`;

  return (
    <CartProvider>
      <div className="min-h-screen bg-bone-50">
        <header className="sticky top-0 z-30 border-b border-border bg-bone-50/95 backdrop-blur-sm">
          <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-4 px-4 sm:px-6">
            <Link href={`${base}/shop`} className="flex flex-col leading-none">
              <span className="font-display text-sm font-bold text-ink-900">
                Profil Design Trading
              </span>
              <span className="mt-0.5 truncate font-display text-[9px] font-semibold uppercase tracking-[0.2em] text-highvis-700">
                {orgName}
              </span>
            </Link>

            <nav className="ml-6 hidden items-center gap-6 sm:flex">
              <Link
                href={`${base}/shop`}
                className="text-sm font-medium text-ink-500 transition-colors hover:text-ink-900"
              >
                {t.shop}
              </Link>
              <Link
                href={`${base}/orders`}
                className="text-sm font-medium text-ink-500 transition-colors hover:text-ink-900"
              >
                {t.orders}
              </Link>
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <CartBadge href={`${base}/cart`} label={t.cart} />
              <UserMenu
                email={user.email ?? "—"}
                roleLabel={user.role ? dict.auth.roles[user.role] : "—"}
                accountLabel={t.account}
                signOutLabel={t.signOut}
                locale={locale}
              />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>
      </div>
    </CartProvider>
  );
}
