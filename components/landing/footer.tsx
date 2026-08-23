import Link from "next/link";
import type { Dictionary, Locale } from "@/lib/i18n";
import { otherLocale } from "@/lib/i18n";
import { Container } from "./section";

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
    <footer className="bg-ink-900 py-14 text-bone-50 md:py-16">
      <Container>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <p className="font-display text-lg font-bold tracking-tight">
              {dict.footer.company}
            </p>
            <p className="mt-1 font-display text-[9px] font-semibold uppercase tracking-[0.24em] text-highvis-400">
              Be your brand
            </p>
            <p className="mt-4 max-w-[36ch] text-sm text-ink-300">
              {dict.footer.tagline}
            </p>
          </div>

          <div>
            <h2 className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-300">
              {dict.footer.showroomsTitle}
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {dict.footer.showrooms.map((city) => (
                <li key={city}>{city}</li>
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
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-bone-200/10 pt-6 text-xs text-ink-300 sm:flex-row sm:items-center sm:justify-between">
          <p className="tabular">
            © {year} {dict.footer.company} · {dict.footer.cvr}
          </p>
          <p>
            {dict.footer.pricesNote} {dict.footer.rights}
          </p>
        </div>
      </Container>
    </footer>
  );
}
