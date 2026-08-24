import { pageMetadata } from "@/lib/page-metadata";
import { getDictionary } from "@/lib/i18n";
import { SIZE_TABLE } from "@/lib/shop/sizing";
import { SizeFinder } from "@/components/shop/size-finder";
import { PageHeader } from "@/components/dashboard/primitives";

export function generateMetadata() {
  return pageMetadata((d) => d.shop.sizeGuide.title);
}

/** Standalone size guide, also linked from every product page. */
export default async function SizeGuidePage() {
  const dict = await getDictionary();
  const t = dict.shop.sizeGuide;

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <SizeFinder dict={t} />

        {/* min-w-0: a grid item defaults to min-width:auto, so the table's
            min-width would stretch the column and scroll the whole page
            sideways instead of scrolling inside its own box. */}
        <div className="min-w-0 rounded-lg border border-border bg-card p-5">
          <h2 className="font-semibold text-ink-900">{t.tableTitle}</h2>

          {/* Scrolls inside its own box: four numeric columns do not fit a
              phone, and the page itself must never scroll sideways. */}
          <div className="-mx-5 mt-4 overflow-x-auto px-5">
            <table className="w-full min-w-[380px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-ink-500">
                  <th className="py-2 pr-3 font-medium">{t.colSize}</th>
                  <th className="py-2 pr-3 font-medium">{t.colEu}</th>
                  <th className="py-2 pr-3 font-medium">{t.colChest}</th>
                  <th className="py-2 font-medium">{t.colWaist}</th>
                </tr>
              </thead>
              <tbody>
                {SIZE_TABLE.map((row) => (
                  <tr key={row.size} className="border-t border-border">
                    <td className="py-2.5 pr-3 font-semibold text-ink-900">
                      {row.size}
                    </td>
                    <td className="tabular py-2.5 pr-3 text-ink-700">{row.eu}</td>
                    <td className="tabular py-2.5 pr-3 text-ink-700">
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

          <div className="mt-5 border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-ink-900">{t.howTitle}</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-ink-500">
              <li>{t.howChest}</li>
              <li>{t.howWaist}</li>
            </ul>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-ink-500">{t.note}</p>
        </div>
      </div>
    </>
  );
}
