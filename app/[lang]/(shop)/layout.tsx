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

  const links = [
    { href: `${base}/shop`, label: t.shop },
    { href: `${base}/orders`, label: t.orders },
    { href: `${base}/account`, label: dict.shop.account.title },
    { href: `${base}/size-guide`, label: dict.shop.sizeGuide.title },
    { href: `${base}/returns`, label: dict.shop.returns.title },
  ];

  return (
    <CartProvider scope={user.id}>
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

            {/* Desktop navigation. On phones the same links live in the
                scrollable strip below the header, so nothing is unreachable
                without opening a menu. */}
            <nav className="ml-6 hidden items-center gap-6 md:flex">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-sm font-medium text-ink-500 transition-colors hover:text-ink-900"
                >
                  {l.label}
                </Link>
              ))}
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
          <nav className="-mb-px overflow-x-auto border-t border-border md:hidden">
            <ul className="flex w-max gap-1 px-2 py-2">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="block rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap text-ink-700 transition-colors hover:bg-secondary"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>
      </div>
    </CartProvider>
  );
}
