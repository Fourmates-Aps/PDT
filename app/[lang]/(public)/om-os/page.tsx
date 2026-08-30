import { publicMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { Problem } from "@/components/landing/problem";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Suppliers } from "@/components/landing/suppliers";
import { PageBanner } from "@/components/public/hero";
import { EditorialGrid } from "@/components/public/editorial-grid";
import { Section } from "@/components/landing/section";
import { COMPANY } from "@/lib/content/company";

export function generateMetadata() {
  return publicMetadata((d) => ({
    title: d.public.about.title,
    description: d.public.about.lead,
  }));
}

/**
 * Om os — the argument for the platform.
 *
 * These three sections used to be the middle of the landing page. They are not
 * gone, they have moved: the front page now has the job the live site's front
 * page does — get a visitor into the range — and a visitor who wants to know why
 * the platform exists follows one link to read it here.
 */
export default async function AboutPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.public.about;

  return (
    <>
      {/* The live site's second hero slide — "Din specialist i branding" — which
          a one-slide front page would otherwise never show anyone. */}
      <PageBanner
        image="/images/photos/hero-branding.webp"
        title={t.title}
        lead={t.lead}
      />

      {/* Their own "Hvem er Profil Design Trading" copy, which the platform
          argument below then builds on. */}
      <Section>
        <div className="max-w-[70ch]">
          <h2 className="text-h3 font-display font-semibold text-ink-900">
            {t.whoTitle}
          </h2>
          {t.who.map((paragraph) => (
            <p
              key={paragraph}
              className="mt-4 text-[15px] leading-relaxed text-ink-700"
            >
              {paragraph}
            </p>
          ))}

          <div className="mt-9 grid gap-8 sm:grid-cols-2">
            <div>
              <h3 className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                {t.offerTitle}
              </h3>
              <ol className="mt-3 space-y-2">
                {t.offer.map((item, i) => (
                  <li key={item} className="flex gap-3 text-[15px] text-ink-800">
                    <span className="tabular font-display text-sm font-bold text-highvis-700">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {item}
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <h3 className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                {t.totalTitle}
              </h3>
              <ul className="mt-3 space-y-2">
                {t.total.map((item) => (
                  <li key={item} className="text-[15px] text-ink-800">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-9 border-l-2 border-highvis-500 pl-4 text-[15px] leading-relaxed text-ink-700">
            {t.closing}
          </p>

          <p className="tabular mt-8 text-xs text-ink-500">
            {COMPANY.legalName} · CVR {COMPANY.cvr} · {COMPANY.founded}
          </p>
        </div>
      </Section>

      <EditorialGrid dict={dict} locale={locale} />
      <Problem dict={dict} />
      <Features dict={dict} />
      <HowItWorks dict={dict} />
      <Suppliers dict={dict} />
    </>
  );
}
