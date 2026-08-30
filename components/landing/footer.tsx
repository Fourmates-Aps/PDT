import Image from "next/image";
import Link from "next/link";
import type { Dictionary, Locale } from "@/lib/i18n";
import { otherLocale } from "@/lib/i18n";
import { Container } from "./section";
import { BrandLogo, NewWaveBadge } from "@/components/public/brand-logo";
import { NewsletterForm } from "@/components/public/newsletter-form";
import { COMPANY } from "@/lib/content/company";
import type { Dictionary as Dict } from "@/lib/i18n";

/** The live site's Information column, in its order. Every route exists. */
const INFORMATION: { href: string; label: (d: Dict) => string }[] = [
  { href: "/om-os", label: (d) => d.public.about.title },
  { href: "/kontakt", label: (d) => d.public.contact.title },
  { href: "/handelsbetingelser", label: () => "Handelsbetingelser" },
  { href: "/webshop", label: (d) => d.public.webshop.title },
  { href: "/kataloger", label: (d) => d.public.catalogues.title },
  { href: "/brands", label: (d) => d.public.brands.title },
  { href: "/stoerrelsesguide", label: (d) => d.public.sizeGuide.title },
];

/** The card marks the live site shows, in the order it shows them. */
const PAYMENT_MARKS = ["visa", "mastercard", "mobilepay"] as const;

export function Footer({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const other = otherLocale(locale);
  const year = new Date().getFullYear();

  return (
    // The client's own product photography sits behind the footer at low
    // opacity, exactly as on the live site — dark enough that the four columns
    // of small text on top of it stay legible.
    <footer className="relative isolate overflow-hidden bg-ink-900 py-14 text-bone-50 md:py-16">
      <Image
        src="/images/photos/footer-texture.webp"
        alt=""
        fill
        sizes="100vw"
        aria-hidden="true"
        className="object-cover object-right opacity-20"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/90 to-ink-900/60" aria-hidden="true" />

      <Container className="relative">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            {/* The wordmark as delivered — light artwork, drawn for exactly this
                kind of dark ground. */}
            <BrandLogo tone="light" className="h-11 w-auto" />
            <p className="mt-4 max-w-[36ch] text-sm text-ink-300">
              {dict.footer.tagline}
            </p>
            <NewWaveBadge className="mt-5 h-11 w-auto" />
          </div>

          <div>
            <h2 className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-300">
              {dict.footer.showroomsTitle}
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {dict.footer.showrooms.map((address) => (
                <li key={address}>{address}</li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-300">
              {dict.footer.informationTitle}
            </h2>
            {/* The live site's Information column, link for link. */}
            <ul className="mt-3 space-y-1.5 text-sm">
              {INFORMATION.map((item) => (
                <li key={item.href}>
                  <Link
                    href={`/${locale}${item.href}`}
                    className="hover:text-highvis-400"
                  >
                    {item.label(dict)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-300">
              {dict.footer.contactTitle}
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li>
                <a
                  href={`tel:+45${dict.footer.phone.replace(/\s/g, "")}`}
                  className="tabular hover:text-highvis-400"
                >
                  {dict.footer.phone}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${COMPANY.email}`}
                  className="hover:text-highvis-400"
                >
                  {COMPANY.email}
                </a>
              </li>
              <li>
                <a
                  href={COMPANY.linkedIn}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-highvis-400"
                >
                  LinkedIn
                </a>
              </li>
              <li>
                <Link
                  href={`/${other}`}
                  hrefLang={other}
                  aria-label={dict.meta.switchToAria}
                  className="hover:text-highvis-400"
                >
                  {dict.meta.switchTo}
                </Link>
              </li>
            </ul>

            {/* Nyhedstilmelding, which the live site keeps in its account menu. */}
            <h2 className="mt-7 font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-300">
              {dict.public.newsletter.title}
            </h2>
            <NewsletterForm dict={dict} locale={locale} />
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-bone-200/10 pt-6 text-xs text-ink-300 sm:flex-row sm:items-center sm:justify-between">
          <p className="tabular">
            © {year} {dict.footer.company} · {dict.footer.cvr}
          </p>

          {/* Marks, not claims: these say which cards the shop accepts today.
              Nothing on this platform takes a payment yet — that is Phase 3. */}
          <ul className="flex items-center gap-2.5">
            {PAYMENT_MARKS.map((mark) => (
              <li key={mark} className="rounded-sm bg-bone-50 px-2 py-1">
                <Image
                  src={`/images/icons/payment/${mark}.svg`}
                  alt={mark}
                  width={38}
                  height={24}
                  className="h-4 w-auto"
                />
              </li>
            ))}
          </ul>

          <p>
            {dict.footer.pricesNote} {dict.footer.rights}
          </p>
        </div>
      </Container>
    </footer>
  );
}
