import Link from "next/link";
import { pageMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { PageHeader } from "@/components/dashboard/primitives";
import { OrgOnboarding } from "@/components/dashboard/org-onboarding";

export function generateMetadata() {
  return pageMetadata((d) => d.auth.orgs.title);
}

/**
 * Platform-admin view of customer organisations.
 *
 * The role check and the chrome now live in the admin layout — KAMs reach the
 * same onboarding component at /dashboard/kam/onboarding, which keeps its own
 * standalone header because it sits outside this prefix.
 */
export default async function AdminOrgsPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <>
      <PageHeader
        title={dict.auth.orgs.title}
        lead={dict.auth.orgs.lead}
        action={
          <Link
            href={`/${locale}/dashboard/admin/orgs/new`}
            className="rounded-md bg-ink-900 px-5 py-2.5 text-sm font-semibold text-bone-50 transition-colors hover:bg-ink-700"
          >
            {dict.admin.onboarding.title}
          </Link>
        }
      />
      <OrgOnboarding dict={dict} locale={locale} />
      <p className="mt-10 text-sm">
        <Link
          href={`/${locale}/dashboard`}
          className="text-ink-500 hover:text-ink-900"
        >
          ← {dict.auth.dashboard.title}
        </Link>
      </p>
    </>
  );
}
