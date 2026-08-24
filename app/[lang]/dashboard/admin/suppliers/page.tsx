import { pageMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { listSuppliers } from "@/lib/db/queries/suppliers";
import { formatNumber } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/dashboard/primitives";
import { MinimumOrderField } from "@/components/dashboard/minimum-order-field";

export function generateMetadata() {
  return pageMetadata((d) => d.admin.suppliers.title);
}

/**
 * Leverandører — the prototype's `suppliers`, backed by the documented
 * integration facts rather than sample rows.
 *
 * Order channel and data channel are shown separately because most suppliers
 * use different routes for the two: Mascot takes orders over EDI but ships
 * product data as a nightly FTP file, and F&H has no order API at all.
 */
export default async function SuppliersPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.admin.suppliers;

  const rows = await listSuppliers();

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-5 py-6">
          <EmptyState>{t.empty}</EmptyState>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-border bg-card p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-semibold text-ink-900">{s.name}</h2>
                  <p className="text-sm text-ink-500">
                    {s.productGroup ?? "—"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-sm bg-ink-900 px-2 py-1 text-[11px] font-semibold text-bone-50">
                    {t.channels[s.orderChannel]}
                  </span>
                  <span className="tabular text-sm text-ink-500">
                    {formatNumber(locale, s.productCount)} {t.colProducts}
                  </span>
                  {s.openUnits > 0 ? (
                    <span className="rounded-sm bg-highvis-50 px-2 py-1 text-[11px] font-semibold text-highvis-700">
                      {t.openUnits.replace("{n}", String(s.openUnits))}
                    </span>
                  ) : null}
                </div>
              </div>

              <dl className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
                <Row label={t.colData} value={s.dataChannel ?? "—"} />
                <Row
                  label={t.colLead}
                  value={`${s.leadTimeDays} ${t.days}`}
                />
                <div>
                  <dt className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
                    {t.colMinimum}
                  </dt>
                  <dd className="mt-1.5">
                    <MinimumOrderField
                      supplierId={s.id}
                      value={s.minimumOrderQty}
                      dict={t}
                    />
                  </dd>
                </div>
              </dl>

              {s.notes ? (
                <div className="mt-4 border-t border-border pt-4">
                  <p className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
                    {t.notesTitle}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-700">
                    {s.notes}
                  </p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs leading-relaxed text-ink-500">{t.dataNote}</p>
      <p className="mt-2 text-xs leading-relaxed text-ink-500">
        {t.minimumHint}
      </p>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
        {label}
      </dt>
      <dd className="mt-1.5 text-sm leading-relaxed text-ink-700">{value}</dd>
    </div>
  );
}
