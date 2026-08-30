"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
// The leaf module, NOT "@/lib/i18n": the barrel there imports next/root-params,
// which is Server-Component-only, so pulling it into a client component fails
// the build outright.
import { locales, type Locale } from "@/lib/i18n/locales";

/**
 * The language switch.
 *
 * Replaces a bare "In English" / "På dansk" link, which had two problems.
 *
 * The visible one: a link naming the OTHER language is ambiguous. "In English"
 * could mean "this page is in English" as easily as "switch to English", and a
 * reader who cannot read the current language is exactly the person least able
 * to resolve that. Both languages are shown instead, with the current one
 * marked — nothing to interpret.
 *
 * The real one: it linked to `/${other}` — the other language's FRONT PAGE.
 * Switching language halfway down /da/handelsbetingelser threw you back to the
 * top of the site. This swaps the locale segment and keeps you where you are.
 *
 * `usePathname` rather than the query string as well: reading searchParams here
 * would force every statically rendered public page into a Suspense boundary or
 * out of static rendering altogether. A switch mid-search loses the `?q=`, which
 * is a smaller cost than that.
 */
export function LocaleSwitch({
  current,
  label,
  className = "",
}: {
  current: Locale;
  /** Accessible name for the group, e.g. "Sprog". */
  label: string;
  className?: string;
}) {
  const pathname = usePathname();

  // "/da/katalog/Skjorter" → "/katalog/Skjorter"; "/da" → ""
  const rest = pathname.replace(/^\/[^/]+/, "");

  return (
    <div
      role="group"
      aria-label={label}
      className={`flex items-center rounded-sm border border-bone-300/60 p-0.5 ${className}`}
    >
      {locales.map((locale) => {
        const active = locale === current;
        return (
          <Link
            key={locale}
            href={`/${locale}${rest}`}
            hrefLang={locale}
            aria-current={active ? "true" : undefined}
            className={`rounded-[2px] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors ${
              active
                ? "bg-ink-900 text-bone-50"
                : "text-ink-500 hover:text-ink-900"
            }`}
          >
            {locale}
          </Link>
        );
      })}
    </div>
  );
}

/** The same control on a dark ground — the footer. */
export function LocaleSwitchDark({
  current,
  label,
  className = "",
}: {
  current: Locale;
  label: string;
  className?: string;
}) {
  const pathname = usePathname();
  const rest = pathname.replace(/^\/[^/]+/, "");

  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex items-center rounded-sm border border-bone-200/20 p-0.5 ${className}`}
    >
      {locales.map((locale) => {
        const active = locale === current;
        return (
          <Link
            key={locale}
            href={`/${locale}${rest}`}
            hrefLang={locale}
            aria-current={active ? "true" : undefined}
            className={`rounded-[2px] px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors ${
              active
                ? "bg-bone-50 text-ink-900"
                : "text-ink-300 hover:text-bone-50"
            }`}
          >
            {locale}
          </Link>
        );
      })}
    </div>
  );
}
