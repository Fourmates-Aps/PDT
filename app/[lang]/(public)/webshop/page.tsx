import Link from "next/link";
import { publicMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { COMPANY, CONTACTS } from "@/lib/content/company";
import { PageBanner } from "@/components/public/hero";
import { StepsStrip } from "@/components/public/steps-strip";
import { Section, SectionHead } from "@/components/landing/section";

export function generateMetadata() {
  return publicMetadata((d) => ({
    title: d.public.webshop.title,
    description: d.public.webshop.lead,
  }));
}

/**
 * Webshop — the live site's "Individuel webshop" page.
 *
 * Their page ends with an order form for choosing a shop type. That form is not
 * reproduced: the platform this page sits on IS the webshop being advertised,
 * and the route from interest to a live customer shop is the KAM onboarding
 * flow, not a self-service picker. The page ends where their copy ends — with an
 * invitation to talk to someone — and names the person their page names.
 */
export default async function WebshopPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.public.webshop;

  // The live page prints this contact for exactly this purpose.
  const sales = CONTACTS.find((c) => c.role.startsWith("Sales")) ?? CONTACTS[0];

  return (
    <>
      <PageBanner
        image="/images/photos/hero-branding.webp"
        title={t.title}
        lead={t.lead}
      />

      <Section>
        <div className="max-w-[68ch]">
          <SectionHead
            eyebrow={dict.public.header.catalogue}
            title={t.lead}
            lead={t.body}
          />
        </div>
      </Section>

      <StepsStrip dict={dict} />

      <Section tone="surface">
        <div className="max-w-[60ch]">
          <h2 className="text-h3 font-display font-semibold text-ink-900">
            {t.ctaTitle}
          </h2>
          <p className="mt-3 text-ink-500">{t.ctaBody}</p>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {sales.email ? (
              <a
                href={`mailto:${sales.email}`}
                className="font-semibold text-ink-900 hover:text-highvis-700"
              >
                {sales.email}
              </a>
            ) : null}
            <a
              href={`tel:${sales.phone.replace(/\s/g, "")}`}
              className="tabular font-semibold text-ink-900 hover:text-highvis-700"
            >
              {sales.phone}
            </a>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={`/${locale}/kontakt`}
              className="rounded-md bg-ink-900 px-6 py-3 text-[15px] font-semibold text-bone-50 transition-colors hover:bg-ink-700"
            >
              {dict.public.contact.title}
            </Link>
            <Link
              href={`/${locale}/ansoeg`}
              className="rounded-md border border-bone-300 px-6 py-3 text-[15px] font-semibold text-ink-800 transition-colors hover:border-ink-900"
            >
              {dict.public.apply.title}
            </Link>
          </div>

          <p className="mt-8 text-xs text-ink-500">
            {COMPANY.legalName} · CVR {COMPANY.cvr}
          </p>
        </div>
      </Section>
    </>
  );
}
