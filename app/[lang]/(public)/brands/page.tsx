import Image from "next/image";
import Link from "next/link";
import { publicMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { listPublicBrands } from "@/lib/db/queries/public-catalogue";
import { Container } from "@/components/landing/section";

export function generateMetadata() {
  return publicMetadata((d) => ({
    title: d.public.brands.title,
    description: d.public.brands.lead,
  }));
}

export const revalidate = 3600;

/**
 * Brands.
 *
 * The wall is the client's real artwork, straight off their Brands page — but it
 * is ONE BITMAP, not forty logo files. Their CMS holds the whole wall as a single
 * 3078×1728 PNG inlined as a base64 data URI, which is why nothing on that page
 * is separately downloadable and why there are no per-brand images to link.
 *
 * That shapes this page. The wall shows what PDT carries, as a picture; the list
 * underneath shows which of those brands the webshop can actually sell today,
 * from `products.brand`, and those link to real stock. Presenting only the wall
 * would imply forty brands are orderable when seven are; presenting only the
 * list would hide most of what the company sells.
 */
export default async function BrandsPage() {
  const [dict, locale, brands] = await Promise.all([
    getDictionary(),
    getLocale(),
    listPublicBrands(),
  ]);

  const t = dict.public.brands;

  return (
    <div className="py-10 md:py-14">
      <Container>
        <header className="max-w-[58ch]">
          <h1 className="text-h2 font-display font-semibold text-balance text-ink-900">
            {t.title}
          </h1>
          <p className="mt-3 text-lead text-ink-500">{t.lead}</p>
          <p className="mt-4 max-w-[64ch] text-ink-500">{t.body}</p>
        </header>

        <section className="mt-10">
          <h2 className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">
            {t.wallTitle}
          </h2>
          {/*
            * One image, so one alt text. It cannot name forty brands usefully to
            * a screen reader, and the list below names the ones that matter —
            * the ones you can actually order.
            */}
          <div className="mt-4 overflow-hidden rounded-lg border border-border bg-white px-4 py-6 sm:px-8 sm:py-10">
            <Image
              src="/images/brands/brand-wall.webp"
              alt={t.wallAlt}
              width={1800}
              height={1011}
              sizes="(min-width: 1200px) 1100px, 92vw"
              className="mx-auto h-auto w-full max-w-[1100px]"
            />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-h3 font-display font-semibold text-ink-900">
            {t.stockedTitle}
          </h2>
          <p className="mt-2 max-w-[64ch] text-sm text-ink-500">
            {t.stockedLead}
          </p>

          {brands.length === 0 ? (
            <p className="mt-6 rounded-lg border border-border bg-card px-5 py-8 text-center text-ink-500">
              {t.empty}
            </p>
          ) : (
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {brands.map((brand) => (
                <li key={brand.name}>
                  <Link
                    href={`/${locale}/katalog?q=${encodeURIComponent(brand.name)}`}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-5 py-5 transition-colors hover:border-ink-300"
                  >
                    <span className="font-display text-lg font-semibold text-ink-900">
                      {brand.name}
                    </span>
                    <span className="tabular shrink-0 text-xs text-ink-500">
                      {t.inRange.replace("{n}", String(brand.products))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </Container>
    </div>
  );
}
