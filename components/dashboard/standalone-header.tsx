import Link from "next/link";
import type { Dictionary, Locale } from "@/lib/i18n";
import { UserMenu } from "./user-menu";

/**
 * Top bar for dashboard pages that sit outside a shell layout.
 *
 * /dashboard, /dashboard/admin/orgs and /dashboard/kam/onboarding each render
 * their own <main> with no surrounding layout, so they had no account menu and
 * therefore no way to sign out — a user landing there was stuck.
 */
export function StandaloneHeader({
  dict,
  locale,
  email,
  roleLabel,
}: {
  dict: Dictionary;
  locale: Locale;
  email: string;
  roleLabel: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bone-50/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-[900px] items-center gap-4 px-5 sm:px-8">
        <Link
          href={`/${locale}/dashboard`}
          className="flex flex-col leading-none"
        >
          <span className="font-display text-sm font-bold text-ink-900">
            Profil Design Trading
          </span>
          <span className="mt-0.5 font-display text-[9px] font-semibold uppercase tracking-[0.2em] text-highvis-700">
            {roleLabel}
          </span>
        </Link>

        <div className="ml-auto">
          <UserMenu
            email={email}
            roleLabel={roleLabel}
            accountLabel={dict.cadmin.nav.account}
            signOutLabel={dict.cadmin.nav.signOut}
            locale={locale}
          />
        </div>
      </div>
    </header>
  );
}
