import Image from "next/image";
import type { Dictionary, Locale } from "@/lib/i18n";
import { Container } from "@/components/landing/section";
import { HeroCarousel, type HeroSlide } from "./hero-carousel";

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
/** Where each slide's artwork actually lives. */
const HERO_IMAGES: Record<string, string> = {
  "hero-workwear": "/images/photos/hero-workwear.jpg",
  "hero-branding": "/images/photos/hero-branding.webp",
};

/**
 * The front page hero — their two slides, their words.
 *
 * A Server Component that resolves the dictionary down to exactly what the
 * carousel needs before handing it over. Passing `dict` straight through would
 * serialise the WHOLE dictionary into the page, which is the payload leak fixed
 * earlier in this file's siblings — admin and pricing copy shipped to anonymous
 * visitors.
 */
export function Hero({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const t = dict.public.hero;

  const slides: HeroSlide[] = t.slides.map((slide) => ({
    image: HERO_IMAGES[slide.image] ?? HERO_IMAGES["hero-workwear"],
    title: slide.title,
    body: slide.body,
    cta: slide.cta,
    href: `/${locale}${slide.href}`,
  }));

  return (
    <HeroCarousel
      slides={slides}
      labels={{
        eyebrow: dict.hero.eyebrow,
        previous: t.previous,
        next: t.next,
        goTo: t.goTo,
        pause: t.pause,
        play: t.play,
        label: t.label,
      }}
    />
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
