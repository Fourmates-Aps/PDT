import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import {
  listPublicCategories,
  listPublicProducts,
} from "@/lib/db/queries/public-catalogue";
import {
  NAV_GROUPS,
  UNGROUPED_LABEL,
  UNGROUPED_SLUG,
  groupBySlug,
  label,
  ungroupedCategories,
} from "@/lib/content/navigation";
import { CatalogueList } from "@/components/public/catalogue-list";
import { Container } from "@/components/landing/section";

export function generateStaticParams() {
  return [...NAV_GROUPS.map((g) => ({ group: g.slug })), { group: UNGROUPED_SLUG }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ group: string }>;
}): Promise<Metadata> {
  const [{ group }, locale] = await Promise.all([params, getLocale()]);
  const name = groupBySlug(group)?.label ?? UNGROUPED_LABEL;
  return publicMetadata(() => ({ title: label(name, locale) }));
}

/**
 * One of the shop's top-level groups — Profiltøj, Arbejdstøj, Fodtøj and so on.
 *
 * The group is theirs; the products under it are ours, resolved through the
 * provisional mapping in lib/content/navigation.ts. A group we carry nothing in
 * still renders, and says so, rather than 404ing or quietly showing the whole
 * catalogue: the nav promises the group exists, and the page has to keep that
 * promise honestly.
 */
export default async function GroupPage({
  params,
}: {
  params: Promise<{ group: string }>;
}) {
  const [dict, locale, { group: slug }] = await Promise.all([
    getDictionary(),
    getLocale(),
    params,
  ]);

  const group = groupBySlug(slug);
  const isUngrouped = slug === UNGROUPED_SLUG;
  if (!group && !isUngrouped) notFound();

  const allCategories = await listPublicCategories(50);
  const categories = isUngrouped
    ? ungroupedCategories(allCategories.map((c) => c.name))
    : (group?.ours ?? []);

  const [products] = await Promise.all([
    listPublicProducts({ categories, limit: 60 }),
  ]);

  const heading = label(group?.label ?? UNGROUPED_LABEL, locale);
  const t = dict.public.groups;

  if (products.length === 0) {
    return (
      <div className="py-10 md:py-14">
        <Container>
          <h1 className="text-h2 font-display font-semibold text-ink-900">
            {heading}
          </h1>

          <div className="mt-6 max-w-[64ch] rounded-lg border border-border bg-card px-5 py-6">
            <p className="font-semibold text-ink-900">{t.emptyTitle}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-700">
              {t.emptyBody}
            </p>

            {group && group.children.length > 0 ? (
              <>
                <p className="mt-5 font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
                  {t.coversTitle}
                </p>
                <p className="mt-2 text-sm text-ink-500">
                  {group.children.map((c) => label(c, locale)).join(" · ")}
                </p>
              </>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/${locale}/katalog`}
                className="rounded-md bg-ink-900 px-5 py-2.5 text-sm font-semibold text-bone-50 transition-colors hover:bg-ink-700"
              >
                {dict.public.catalogue.allCategories}
              </Link>
              <Link
                href={`/${locale}/kontakt`}
                className="rounded-md border border-bone-300 px-5 py-2.5 text-sm font-semibold text-ink-800 transition-colors hover:border-ink-900"
              >
                {dict.public.contact.title}
              </Link>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <CatalogueList
      products={products}
      categories={allCategories}
      heading={heading}
      dict={dict}
      locale={locale}
    />
  );
}
