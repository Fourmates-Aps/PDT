import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { publicMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { COMPANY, CONTACTS } from "@/lib/content/company";
import { Container } from "@/components/landing/section";

export function generateMetadata() {
  return publicMetadata((d) => ({
    title: d.public.catalogues.title,
    description: d.public.catalogues.lead,
  }));
}

/**
 * Kataloger.
 *
 * ⚠ THE UPSTREAM LINK IS BROKEN, which is why this page has no catalogue on it.
 *
 * The live site's "Kataloger" link points at
 * /https-profildesigntradingdk-https-viewerjoomagcom-jakkekatalog-aw2023-joomag-0500006001694087654short/
 * — a Joomag viewer URL that was pasted into a CMS link field and slugified into
 * a path on their own domain. That path returns 200 and renders an empty page
 * with a phone number on it, so the failure is invisible: nothing 404s, the
 * catalogue simply never appears. Rebuilding the intended address
 * (viewer.joomag.com/jakkekatalog-aw2023/0500006001694087654) returns 404 too,
 * so the catalogue is either gone or moved.
 *
 * Linking to a guess would be worse than linking to nothing. The page says what
 * is true today and offers the route that works — asking a human — until PDT
 * supplies the real catalogue URLs or files.
 */
export default async function CataloguesPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.public.catalogues;
  const sales = CONTACTS.find((c) => c.role.startsWith("Sales")) ?? CONTACTS[0];

  return (
    <div className="py-10 md:py-14">
      <Container>
        <header className="max-w-[58ch]">
          <h1 className="text-h2 font-display font-semibold text-balance text-ink-900">
            {t.title}
          </h1>
          <p className="mt-3 text-lead text-ink-500">{t.lead}</p>
        </header>

        <div className="mt-8 max-w-[64ch] rounded-lg border border-warning/30 bg-warning/5 px-5 py-5">
          <p className="flex items-center gap-2 font-semibold text-ink-900">
            <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden="true" />
            {t.unavailableTitle}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">
            {t.unavailableBody}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {sales.email ? (
              <a
                href={`mailto:${sales.email}`}
                className="font-semibold text-ink-900 hover:text-highvis-700"
              >
                {sales.email}
              </a>
            ) : null}
            <a
              href={`tel:+45${COMPANY.phone.replace(/\s/g, "")}`}
              className="tabular font-semibold text-ink-900 hover:text-highvis-700"
            >
              {COMPANY.phone}
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
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
  );
}
