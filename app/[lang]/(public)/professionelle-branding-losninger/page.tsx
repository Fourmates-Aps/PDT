import Image from "next/image";
import Link from "next/link";
import { publicMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { PageBanner } from "@/components/public/hero";
import { Container } from "@/components/landing/section";

export function generateMetadata() {
  return publicMetadata((d) => ({
    title: d.public.branding.title,
    description: d.public.branding.lead,
  }));
}

/**
 * Professionelle brandingløsninger — the live site's page of the same name.
 *
 * Five sections, alternating side to side so a long page of image-and-text does
 * not read as one column of repeats.
 *
 * Their sixth block, "Wear your brand", is not reproduced as a section: on their
 * site its headline and body are BAKED INTO A BITMAP, which cannot be
 * translated, selected, searched or read aloud. The photography from it is used
 * for "Dress your brand" — cropped past the pixel text — and the words it
 * carried are covered by the Dress copy, which says the same thing in real text.
 *
 * The URL keeps their slug rather than a shorter Danish one, so existing links
 * and search results survive a cutover.
 */
export default async function BrandingPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.public.branding;

  return (
    <>
      <PageBanner
        image="/images/photos/hero-branding.webp"
        title={t.title}
        lead={t.lead}
      />

      <div className="py-12 md:py-16">
        <Container>
          <div className="flex flex-col gap-14 md:gap-20">
            {t.sections.map((section, i) => (
              <section
                key={section.image}
                className="grid items-center gap-8 md:grid-cols-2 md:gap-12"
              >
                {/* Odd rows put the picture on the right; on a phone the image
                    always leads, because the heading is right under it. */}
                <div
                  className={
                    i % 2 === 1 ? "md:order-2" : undefined
                  }
                >
                  <div className="overflow-hidden rounded-lg border border-border bg-bone-100">
                    <Image
                      src={`/images/branding/${section.image}.webp`}
                      alt={section.title}
                      width={833}
                      height={400}
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="h-auto w-full object-cover"
                    />
                  </div>
                </div>

                <div className={i % 2 === 1 ? "md:order-1" : undefined}>
                  <h2 className="font-display text-h3 font-bold uppercase tracking-[0.02em] text-ink-900">
                    {section.title}
                  </h2>
                  <div className="mt-1.5 h-0.75 w-12 rounded-sm bg-highvis-500" />
                  {section.body.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="mt-4 max-w-[56ch] text-[15px] leading-relaxed text-ink-700"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-16 flex flex-wrap gap-3 border-t border-border pt-10">
            <Link
              href={`/${locale}/katalog`}
              className="rounded-md bg-ink-900 px-6 py-3 text-[15px] font-semibold text-bone-50 transition-colors hover:bg-ink-700"
            >
              {dict.public.header.catalogue}
            </Link>
            <Link
              href={`/${locale}/kontakt`}
              className="rounded-md border border-bone-300 px-6 py-3 text-[15px] font-semibold text-ink-800 transition-colors hover:border-ink-900"
            >
              {dict.public.contact.title}
            </Link>
          </div>
        </Container>
      </div>
    </>
  );
}
