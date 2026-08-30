import Link from "next/link";
import { pageMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getSessionUser } from "@/lib/supabase/server";
import { getMember, listMyOrders } from "@/lib/db/queries/shop";
import { EmptyState, PageHeader } from "@/components/dashboard/primitives";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney } from "@/lib/format";
import { orderBadgeTone } from "@/lib/production";

export function generateMetadata() {
  return pageMetadata((d) => d.shop.orders.title);
}

export default async function MyOrdersPage() {
  const [dict, locale, user] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSessionUser(),
  ]);

  const t = dict.shop.orders;
  const organisationId = user?.organisationId;

  if (!user || !organisationId) {
    return (
      <>
        <PageHeader title={t.title} lead={t.lead} />
        <EmptyState>{dict.shop.grid.noOrg}</EmptyState>
      </>
    );
  }

  const member = await getMember(user.id, organisationId);
  // Scoped to this member: an employee sees their own orders, never the
  // organisation's. Colleagues' spending is not their business.
  const rows = member ? await listMyOrders(member.id, organisationId) : [];

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      {rows.length === 0 ? (
        <EmptyState>{t.empty}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((o) => (
            <li key={o.id}>
              <Link
                href={`/${locale}/orders/${o.orderNumber}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-ink-300"
              >
                <div className="min-w-0">
                  <p className="tabular font-semibold text-ink-900">
                    {o.orderNumber}
                  </p>
                  <p className="tabular text-sm text-ink-500">
                    {formatDate(locale, o.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant={orderBadgeTone(o.status)}>
                    {dict.cadmin.orders.statuses[o.status]}
                  </Badge>
                  <span className="tabular font-semibold text-ink-900">
                    {formatMoney(locale, o.totalDkk)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
