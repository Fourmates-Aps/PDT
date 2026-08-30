import { pageMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getSessionUser } from "@/lib/supabase/server";
import { listOrders } from "@/lib/db/queries/customer";
import {
  EmptyState,
  PageHeader,
  SectionCard,
} from "@/components/dashboard/primitives";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import { orderBadgeTone } from "@/lib/production";

export function generateMetadata() {
  return pageMetadata((d) => d.cadmin.orders.title);
}

export default async function OrdersPage() {
  const [dict, locale, user] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSessionUser(),
  ]);

  const t = dict.cadmin.orders;
  const organisationId = user?.organisationId;

  if (!organisationId) {
    return (
      <>
        <PageHeader title={t.title} lead={t.lead} />
        <EmptyState>{dict.auth.employees.noOrg}</EmptyState>
      </>
    );
  }

  const rows = await listOrders(organisationId);

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      {rows.length === 0 ? (
        <SectionCard title={t.title}>
          <EmptyState>{t.empty}</EmptyState>
        </SectionCard>
      ) : (
        <>
          {/* Phones: a card per order. A six-column table forced onto a 390px
              screen is unreadable however you scroll it. */}
          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((o) => (
              <li
                key={o.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="tabular font-semibold text-ink-900">
                      {o.orderNumber}
                    </p>
                    <p className="truncate text-sm text-ink-500">
                      {o.memberName ?? "—"}
                    </p>
                  </div>
                  <span className="tabular shrink-0 font-semibold text-ink-900">
                    {formatMoney(locale, o.totalDkk)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant={orderBadgeTone(o.status)}>
                    {t.statuses[o.status]}
                  </Badge>
                  <Badge variant="secondary">
                    {t.payments[o.paymentMethod]}
                  </Badge>
                  <span className="tabular ml-auto text-xs text-ink-500">
                    {formatDate(locale, o.createdAt)}
                  </span>
                </div>
                {o.glsTrackUrl ? (
                  <a
                    href={o.glsTrackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block text-sm font-semibold text-highvis-700 hover:text-highvis-800"
                  >
                    {t.tracking} →
                  </a>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="hidden md:block">
            <SectionCard title={t.title}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.order}</TableHead>
                    <TableHead>{t.placedBy}</TableHead>
                    <TableHead>{t.date}</TableHead>
                    <TableHead>{t.status}</TableHead>
                    <TableHead>{t.payment}</TableHead>
                    <TableHead className="text-right">{t.total}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="tabular font-semibold text-ink-900">
                        {o.orderNumber}
                      </TableCell>
                      <TableCell>{o.memberName ?? "—"}</TableCell>
                      <TableCell className="tabular text-ink-500">
                        {formatDate(locale, o.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={orderBadgeTone(o.status)}>
                          {t.statuses[o.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-ink-500">
                        {t.payments[o.paymentMethod]}
                      </TableCell>
                      <TableCell className="tabular text-right font-semibold text-ink-900">
                        {formatMoney(locale, o.totalDkk)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SectionCard>
          </div>
        </>
      )}
    </>
  );
}
