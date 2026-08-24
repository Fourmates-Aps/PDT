import Link from "next/link";
import { eq } from "drizzle-orm";
import { pageMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { db } from "@/lib/db";
import { organisations } from "@/lib/db/schema";
import {
  listCatalogueBrands,
  listCatalogueCategories,
  listPricingRows,
  summarise,
} from "@/lib/db/queries/pricing";
import { PageHeader, SectionCard } from "@/components/dashboard/primitives";
import { ShopBasicsForm } from "@/components/dashboard/shop-basics-form";
import { AssortmentPicker } from "@/components/dashboard/assortment-picker";
import { ActionForm, Field } from "@/components/dashboard/action-form";
import { inviteOrgAdminAction } from "@/app/[lang]/dashboard/actions";

export function generateMetadata() {
  return pageMetadata((d) => d.admin.onboarding.title);
}

type Search = {
  trin?: string;
  kunde?: string;
  maerke?: string;
  kategori?: string;
};

/** Products offered in the step-2 picker before it stops listing. */
const PICKER_LIMIT = 120;

/**
 * Opret kundeshop — the prototype's `opret` wizard.
 *
 * Steps live in the URL rather than in client state, so a half-finished
 * onboarding survives a refresh and can be handed to a colleague. Each step
 * reads the customer back from the database instead of carrying a draft
 * forward: the organisation exists from step 1 onward, and there is no
 * in-memory copy that can disagree with it.
 */
export default async function NewCustomerShopPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const [dict, locale, params] = await Promise.all([
    getDictionary(),
    getLocale(),
    searchParams,
  ]);

  const t = dict.admin.onboarding;
  const base = `/${locale}/dashboard/admin/orgs/new`;

  const customer = params.kunde
    ? (
        await db
          .select({
            id: organisations.id,
            name: organisations.name,
            slug: organisations.slug,
            minimumDgPct: organisations.minimumDgPct,
          })
          .from(organisations)
          .where(eq(organisations.id, params.kunde))
          .limit(1)
      )[0]
    : undefined;

  // A step that needs a customer falls back to step 1 when there is none, so a
  // hand-edited URL cannot land on an empty picker.
  const step = !customer ? 1 : params.trin === "3" ? 3 : params.trin === "2" ? 2 : 1;

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      <Steps
        current={step}
        labels={[t.step1, t.step2, t.step3]}
        customerName={customer?.name}
      />

      {step === 1 ? (
        <SectionCard title={t.basicsTitle} lead={t.basicsLead} className="mt-6">
          <ShopBasicsForm dict={t} locale={locale} />
        </SectionCard>
      ) : null}

      {step === 2 && customer ? (
        <StepTwo
          base={base}
          customer={customer}
          params={params}
          dict={t}
          locale={locale}
        />
      ) : null}

      {step === 3 && customer ? (
        <StepThree base={base} customer={customer} dict={t} locale={locale} />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */

function Steps({
  current,
  labels,
  customerName,
}: {
  current: number;
  labels: string[];
  customerName?: string;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-card px-5 py-4">
      {labels.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-3">
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                done || active
                  ? "bg-ink-900 text-bone-50"
                  : "bg-bone-200 text-ink-500"
              }`}
            >
              {done ? "✓" : n}
            </span>
            <span
              className={`text-sm ${active ? "font-semibold text-ink-900" : "text-ink-500"}`}
            >
              {label}
            </span>
            {n < labels.length ? (
              <span aria-hidden="true" className="text-ink-300">
                →
              </span>
            ) : null}
          </li>
        );
      })}
      {customerName ? (
        <li className="ml-auto text-sm font-semibold text-highvis-700">
          {customerName}
        </li>
      ) : null}
    </ol>
  );
}

async function StepTwo({
  base,
  customer,
  params,
  dict,
  locale,
}: {
  base: string;
  customer: { id: string; name: string; minimumDgPct: string };
  params: Search;
  dict: Awaited<ReturnType<typeof getDictionary>>["admin"]["onboarding"];
  locale: string;
}) {
  const brand = params.maerke || null;
  const category = params.kategori || null;

  const [brands, categories, rows] = await Promise.all([
    listCatalogueBrands(),
    listCatalogueCategories(brand ?? undefined),
    listPricingRows(
      {
        brand: brand ?? undefined,
        category: category ?? undefined,
        organisationId: customer.id,
      },
      PICKER_LIMIT,
    ),
  ]);

  const href = (next: Partial<Search>) => {
    const qs = new URLSearchParams({ trin: "2", kunde: customer.id });
    const maerke = next.maerke !== undefined ? next.maerke : (brand ?? undefined);
    const kategori =
      next.kategori !== undefined ? next.kategori : (category ?? undefined);
    if (maerke) qs.set("maerke", maerke);
    if (kategori) qs.set("kategori", kategori);
    return `${base}?${qs.toString()}`;
  };

  return (
    <SectionCard
      title={dict.assortmentTitle}
      lead={dict.assortmentLead}
      className="mt-6"
      action={
        <Link
          href={`${base}?trin=3&kunde=${customer.id}`}
          className="text-sm font-semibold text-ink-900 underline underline-offset-4 hover:text-highvis-700"
        >
          {dict.next}
        </Link>
      }
    >
      <div className="-mx-5 mb-5 overflow-x-auto px-5">
        <div className="flex w-max gap-2">
          <FilterChip
            href={href({ maerke: undefined, kategori: undefined })}
            label={dict.all}
            on={!brand && !category}
          />
          {brands.map((b) => (
            <FilterChip
              key={b.brand}
              href={href({ maerke: b.brand, kategori: undefined })}
              label={`${b.brand} (${b.count})`}
              on={brand === b.brand}
            />
          ))}
        </div>
      </div>

      {categories.length > 1 ? (
        <div className="-mx-5 mb-5 overflow-x-auto px-5">
          <div className="flex w-max gap-2">
            {categories.map((c) => (
              <FilterChip
                key={c.category}
                href={href({ kategori: c.category })}
                label={`${c.category} (${c.count})`}
                on={category === c.category}
              />
            ))}
          </div>
        </div>
      ) : null}

      <AssortmentPicker
        rows={rows}
        organisationId={customer.id}
        dict={dict}
        defaultMarkup={suggestedMarkup(Number(customer.minimumDgPct))}
      />

      <p className="mt-6 text-sm">
        <Link
          href={`/${locale}/dashboard/admin/pricing?kunde=${customer.id}`}
          className="text-ink-500 transition-colors hover:text-ink-900"
        >
          {dict.dgFix}
        </Link>
      </p>
    </SectionCard>
  );
}

async function StepThree({
  base,
  customer,
  dict,
  locale,
}: {
  base: string;
  customer: { id: string; name: string; minimumDgPct: string };
  dict: Awaited<ReturnType<typeof getDictionary>>["admin"]["onboarding"];
  locale: string;
}) {
  const minimumDg = Number(customer.minimumDgPct);
  const rows = await listPricingRows(
    { organisationId: customer.id, onlyAssortment: true },
    500,
  );
  const summary = summarise(rows, minimumDg);

  const empty = rows.length === 0;
  const blocked = summary.belowMinimum > 0;

  return (
    <>
      <SectionCard
        title={dict.dgTitle}
        className="mt-6"
        action={
          <Link
            href={`${base}?trin=2&kunde=${customer.id}`}
            className="text-sm text-ink-500 transition-colors hover:text-ink-900"
          >
            {dict.backToStep2}
          </Link>
        }
      >
        {empty ? (
          <p className="rounded-md border border-warning/30 bg-warning/5 px-3.5 py-2.5 text-sm text-ink-800">
            {dict.dgEmpty}
          </p>
        ) : blocked ? (
          <>
            <p className="rounded-md border border-error/30 bg-error/5 px-3.5 py-2.5 text-sm text-ink-800">
              {dict.dgBlocked
                .replace("{n}", String(summary.belowMinimum))
                .replace("{dg}", String(minimumDg))}
            </p>
            <p className="mt-4 text-sm">
              <Link
                href={`/${locale}/dashboard/admin/pricing?kunde=${customer.id}`}
                className="font-semibold text-ink-900 underline underline-offset-4 hover:text-highvis-700"
              >
                {dict.dgFix}
              </Link>
            </p>
          </>
        ) : (
          <p className="rounded-md border border-success/30 bg-success/5 px-3.5 py-2.5 text-sm text-success">
            {dict.dgOk
              .replace("{n}", String(summary.products))
              .replace("{dg}", String(minimumDg))}
          </p>
        )}

        {!empty ? (
          <dl className="mt-5 grid gap-4 sm:grid-cols-3">
            <Figure label={dict.step2} value={String(summary.products)} />
            <Figure
              label={dict.dgTitle}
              value={
                summary.medianDg === null ? "—" : `${summary.medianDg} %`
              }
            />
            <Figure label={dict.minimumDg} value={`${minimumDg} %`} />
          </dl>
        ) : null}
      </SectionCard>

      {/* The invite is the activation: the shop is live the moment its
          administrator can sign in. Gated on the margin floor rather than
          warned about, because a shop activated below it is a loss per order. */}
      {!empty && !blocked ? (
        <SectionCard
          title={dict.inviteTitle}
          lead={dict.inviteLead}
          className="mt-6"
        >
          <ActionForm
            action={inviteOrgAdminAction}
            submitLabel={dict.invite}
            pendingLabel={dict.inviting}
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="organisationId" value={customer.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="email" label={dict.email} type="email" required />
              <Field name="fullName" label={dict.fullName} />
            </div>
          </ActionForm>

          <p className="mt-5 text-xs text-ink-500">{dict.done}</p>
        </SectionCard>
      ) : null}

      <p className="mt-8 text-sm">
        <Link
          href={base}
          className="text-ink-500 transition-colors hover:text-ink-900"
        >
          {dict.startOver}
        </Link>
      </p>
    </>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border px-4 py-3">
      <dt className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
        {label}
      </dt>
      <dd className="tabular mt-1 text-xl font-bold text-ink-900">{value}</dd>
    </div>
  );
}

function FilterChip({
  href,
  label,
  on,
}: {
  href: string;
  label: string;
  on: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
        on
          ? "border-ink-900 bg-ink-900 text-bone-50"
          : "border-border text-ink-700 hover:border-ink-900"
      }`}
    >
      {label}
    </Link>
  );
}

/** Markup that lands on the customer's floor, rounded to something sayable. */
function suggestedMarkup(minimumDgPct: number): number {
  if (!Number.isFinite(minimumDgPct) || minimumDgPct <= 0 || minimumDgPct >= 100) {
    return 45;
  }
  const dg = minimumDgPct / 100;
  return Math.ceil((dg / (1 - dg)) * 100);
}
