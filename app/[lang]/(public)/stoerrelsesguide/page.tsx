import Link from "next/link";
import { Check } from "lucide-react";
import { publicMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { SIZE_TABLE } from "@/lib/shop/sizing";
import { Container } from "@/components/landing/section";

export function generateMetadata() {
  return publicMetadata((d) => ({
    title: d.public.sizeGuide.title,
    description: d.public.sizeGuide.lead,
  }));
}

/**
 * Størrelsesguide, public version.
 *
 * The live site's size guide is at /job — a URL from whatever the page used to
 * be, still labelled "Størrelsesguide" in the footer. This is at a URL that says
 * what it is.
 *
 * Their page gives the advice but no table to compare against, which leaves
 * "sammenlign med tabellen" pointing at nothing. The table here is the one the
 * signed-in shop already measures against (lib/shop/sizing.ts), so a visitor and
 * an employee are told the same numbers. The find-my-size calculator stays
 * behind the login, where it can also read what the person ordered last time.
 */
export default async function SizeGuidePage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.public.sizeGuide;

  return (
    <div className="py-10 md:py-14">
      <Container>
        <header className="max-w-[58ch]">
          <h1 className="text-h2 font-display font-semibold text-balance text-ink-900">
            {t.title}
          </h1>
          <p className="mt-3 text-lead text-ink-500">{t.lead}</p>
        </header>

        <ul className="mt-8 space-y-3">
          {t.points.map((point) => (
            <li key={point} className="flex gap-3 text-[15px] text-ink-800">
              <Check
                className="mt-1 size-4 shrink-0 text-success"
                aria-hidden="true"
              />
              {point}
            </li>
          ))}
        </ul>

        <section className="mt-10">
          <h2 className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">
            {t.tableTitle}
          </h2>

          {/* Scrolls inside its own box on a phone rather than widening the page. */}
          <div className="-mx-5 mt-4 overflow-x-auto px-5 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[460px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-500">
                  <th className="py-2.5 pr-4 font-medium">{t.colSize}</th>
                  <th className="py-2.5 pr-4 font-medium">{t.colEu}</th>
                  <th className="py-2.5 pr-4 font-medium">{t.colChest}</th>
                  <th className="py-2.5 font-medium">{t.colWaist}</th>
                </tr>
              </thead>
              <tbody>
                {SIZE_TABLE.map((row) => (
                  <tr key={row.size} className="border-b border-border">
                    <td className="py-2.5 pr-4 font-semibold text-ink-900">
                      {row.size}
                    </td>
                    <td className="tabular py-2.5 pr-4 text-ink-700">{row.eu}</td>
                    <td className="tabular py-2.5 pr-4 text-ink-700">
                      {row.chest[0]}–{row.chest[1]}
                    </td>
                    <td className="tabular py-2.5 text-ink-700">
                      {row.waist[0]}–{row.waist[1]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10 max-w-[60ch] rounded-lg border border-border bg-bone-100/60 px-5 py-5">
          <h2 className="font-semibold text-ink-900">{t.helpTitle}</h2>
          <p className="mt-1.5 text-sm text-ink-700">{t.helpBody}</p>
          <Link
            href={`/${locale}/kontakt`}
            className="mt-4 inline-block rounded-md bg-ink-900 px-5 py-2.5 text-sm font-semibold text-bone-50 transition-colors hover:bg-ink-700"
          >
            {dict.public.contact.title}
          </Link>
        </section>
      </Container>
    </div>
  );
}
