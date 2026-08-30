import Image from "next/image";
import Link from "next/link";
import type { Dictionary, Locale } from "@/lib/i18n";
import { Container, Eyebrow } from "@/components/landing/section";

/**
 * The hero band.
 *
 * This replaces the drawn garment-specification figure that stood here before.
 * That drawing existed because the brand guidelines rule out BORROWED stock
 * imagery — but this photograph is not borrowed: it is Profil Design Trading's
 * own hero slide, lifted from their live site along with the rest of their
 * assets. The reason for the illustration no longer applies.
 *
 * The live site runs two slides on a carousel. This shows one. A carousel needs
 * client JavaScript, moves under anyone reading slowly, and — on every site that
 * has ever been measured — has its second slide seen by almost nobody. The
 * second slide's artwork is not wasted; it heads /om-os.
 */
export function Hero({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  return (
    <div className="relative isolate overflow-hidden bg-ink-900">
      <Image
        src="/images/photos/hero-workwear.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        aria-hidden="true"
        className="object-cover object-center"
      />
      {/*
        * A left-weighted scrim rather than a flat wash: the photograph's subject
        * is on the right, and dimming the whole frame to make text legible would
        * throw away the half of the picture worth showing.
        */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-ink-900/95 via-ink-900/75 to-ink-900/25"
        aria-hidden="true"
      />

      <Container className="relative py-16 md:py-24 lg:py-28">
        <div className="max-w-[46ch]">
          <Eyebrow tone="dark">{dict.hero.eyebrow}</Eyebrow>
          <div className="mt-4 h-[3px] w-14 rounded-sm bg-highvis-500" />
          <h1 className="mt-6 text-display font-display font-bold text-balance text-bone-50">
            {dict.hero.title}
          </h1>
          <p className="mt-6 max-w-[52ch] text-lead text-bone-50/80">
            {dict.hero.lead}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href="#contact"
              className="rounded-md bg-highvis-500 px-6 py-3.5 text-[15px] font-semibold text-ink-900 transition-colors hover:bg-highvis-400"
            >
              {dict.hero.ctaPrimary}
            </a>
            <Link
              href={`/${locale}/katalog`}
              className="rounded-md border border-bone-50/30 px-6 py-3.5 text-[15px] font-semibold text-bone-50 transition-colors hover:border-bone-50"
            >
              {dict.public.header.catalogue}
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}

/**
 * The same treatment, smaller, for the top of an inner page — where the live
 * site's second slide ends up.
 */
export function PageBanner({
  image,
  title,
  lead,
}: {
  image: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="relative isolate overflow-hidden bg-ink-900">
      {/*
        * Anchored right, not centred. A 1400×500 photograph cropped to a banner
        * band shows only its middle stripe, and in this picture that stripe is
        * the dark bag — so the banner read as a plain black bar. The subject of
        * the shot sits on the right.
        */}
      <Image
        src={image}
        alt=""
        fill
        sizes="100vw"
        aria-hidden="true"
        className="object-cover object-right"
      />
      <div
        className="absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/85 to-ink-900/20"
        aria-hidden="true"
      />
      <Container className="relative py-16 md:py-20">
        <h1 className="max-w-[24ch] text-h1 font-display font-bold text-balance text-bone-50">
          {title}
        </h1>
        {lead ? (
          <p className="mt-3 max-w-[54ch] text-lead text-bone-50/80">{lead}</p>
        ) : null}
      </Container>
    </div>
  );
}
