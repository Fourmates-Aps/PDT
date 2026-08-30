import { publicMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { Problem } from "@/components/landing/problem";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Suppliers } from "@/components/landing/suppliers";
import { PageBanner } from "@/components/public/hero";
import { EditorialGrid } from "@/components/public/editorial-grid";

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

      <EditorialGrid dict={dict} locale={locale} />
      <Problem dict={dict} />
      <Features dict={dict} />
      <HowItWorks dict={dict} />
      <Suppliers dict={dict} />
    </>
  );
}
