import Link from "next/link";
import { pageMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { getSessionUser } from "@/lib/supabase/server";
import { getMember, listReturnableItems } from "@/lib/db/queries/shop";
import { ReturnForm } from "@/components/shop/return-form";
import { PageHeader } from "@/components/dashboard/primitives";
import { formatDate } from "@/lib/format";

export function generateMetadata() {
  return pageMetadata((d) => d.shop.returns.title);
}

export default async function ReturnsPage() {
  const [dict, locale, user] = await Promise.all([
    getDictionary(),
    getLocale(),
    getSessionUser(),
  ]);

  const t = dict.shop.returns;
  const organisationId = user?.organisationId;

  const member =
    user && organisationId ? await getMember(user.id, organisationId) : null;
  const items =
    member && organisationId
      ? await listReturnableItems(organisationId, member.id)
      : [];

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {items.length === 0 ? (
          <section className="rounded-lg border border-border bg-card px-6 py-14 text-center">
            <p className="text-ink-500">{t.empty}</p>
            <Link
              href={`/${locale}/shop`}
              className="mt-5 inline-block rounded-md bg-ink-900 px-5 py-2.5 text-sm font-semibold text-bone-50 transition-colors hover:bg-ink-700"
            >
              {t.emptyCta}
            </Link>
          </section>
        ) : (
          <ReturnForm
            items={items.map((i) => ({
              id: i.id,
              orderNumber: i.orderNumber,
              label: i.label,
              orderedOn: formatDate(locale, i.orderedOn),
            }))}
            dict={t}
          />
        )}

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="font-semibold text-ink-900">{t.howTitle}</h2>
          <ol className="mt-4 flex flex-col gap-3">
            {t.steps.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-bold text-bone-50">
                  {i + 1}
                </span>
                <span className="text-sm text-ink-700">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-ink-500">
            {t.notLive}
          </p>
        </section>
      </div>
    </>
  );
}
