import Link from "next/link";
import type { Dictionary, Locale } from "@/lib/i18n";
import { otherLocale } from "@/lib/i18n";
import { Container } from "./section";

/**
 * Sticky header. Everything here is a plain link, so the whole component stays a
 * Server Component — the language switch is a navigation, not a state toggle, and
 * the one-page nav does not need a JavaScript mobile drawer.
 */
export function Header({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const other = otherLocale(locale);

  const links = [
    { href: "#solution", label: dict.nav.solution },
    { href: "#how", label: dict.nav.how },
    { href: "#range", label: dict.nav.range },
    { href: "#esg", label: dict.nav.esg },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-bone-200 bg-bone-50/90 backdrop-blur-sm">
      <Container className="flex h-16 items-center gap-6">
        <Link
          href={`/${locale}`}
          className="flex shrink-0 flex-col leading-none"
          aria-label="Profil Design Trading"
        >
          <span className="font-display text-[15px] font-bold tracking-tight text-ink-900">
            Profil Design Trading
          </span>
          <span className="mt-[3px] font-display text-[9px] font-semibold uppercase tracking-[0.24em] text-highvis-700">
            Be your brand
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-7 lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-ink-500 transition-colors hover:text-ink-900"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 lg:ml-0">
          <Link
            href={`/${other}`}
            hrefLang={other}
            aria-label={dict.meta.switchToAria}
            className="rounded-sm px-2 py-1 font-display text-xs font-semibold uppercase tracking-[0.12em] text-ink-500 transition-colors hover:text-ink-900"
          >
            {dict.meta.switchTo}
          </Link>
          <a
            href="#contact"
            className="rounded-md bg-ink-900 px-4 py-2.5 text-sm font-semibold text-bone-50 transition-colors hover:bg-ink-700"
          >
            {dict.nav.cta}
          </a>
        </div>
      </Container>
    </header>
  );
}
