import Link from "next/link";
import { redirect } from "next/navigation";
import { pageMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getSessionUser } from "@/lib/supabase/server";
import { ROLES } from "@/lib/auth/roles";
import { PageHeader } from "@/components/dashboard/primitives";
import { StandaloneHeader } from "@/components/dashboard/standalone-header";
import { OrgOnboarding } from "@/components/dashboard/org-onboarding";

export function generateMetadata() {
  return pageMetadata((d) => d.auth.orgs.title);
}

/**
 * Customer onboarding for Key Account Managers (dev brief §5.6).
 *
 * Same surface as /dashboard/admin/orgs, reachable by a KAM. Previously the only
 * route was under /dashboard/admin, which the proxy restricts to platform admins
 * — so a KAM could not onboard a customer at all.
 */
export default async function KamOnboardingPage() {
  const [dict, locale, user] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSessionUser(),
  ]);

  if (!user) redirect(`/${locale}/login`);
  if (user.role !== ROLES.KEY_ACCOUNT_MANAGER && user.role !== ROLES.ADMIN) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <>
      <StandaloneHeader
        dict={dict}
        locale={locale}
        email={user.email ?? "—"}
        roleLabel={user.role ? dict.auth.roles[user.role] : "—"}
      />
      <main className="mx-auto w-full max-w-[900px] px-5 py-14 sm:px-8">
        <PageHeader title={dict.auth.orgs.title} lead={dict.auth.orgs.lead} />
        <OrgOnboarding dict={dict} locale={locale} />
        <p className="mt-10 text-sm">
          <Link
            href={`/${locale}/dashboard`}
            className="text-ink-500 hover:text-ink-900"
          >
            ← {dict.auth.dashboard.title}
          </Link>
        </p>
      </main>
    </>
  );
}
