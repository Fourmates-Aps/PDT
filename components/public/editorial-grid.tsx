import Image from "next/image";
import Link from "next/link";
import type { Dictionary, Locale } from "@/lib/i18n";
import { Section, SectionHead } from "@/components/landing/section";

/**
 * What Profil Design Trading supplies, in their own photographs.
 *
 * These six pictures and their labels are the live site's editorial cards. They
 * are NOT the category tiles on the front page: those are built from
 * `products.category` and lead to a filtered range, whereas these six areas —
 * Profiltøj, Firmagave, Arbejdstøj, Arbejdssko, Webshopløsning, Kataloger — are
 * how the business describes itself, and no mapping between the two exists in
 * anything we hold. Putting them on the same page as competing navigation would
 * invent that mapping; putting them here, on the page about the company, does
 * not.
 *
 * Every card links to the whole range for the same reason: claiming "Arbejdssko"
 * filters to safety footwear would be a promise the data cannot keep.
 */
export function EditorialGrid({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const t = dict.public.editorial;

  return (
    <Section tone="surface">
      <SectionHead eyebrow={t.eyebrow} title={t.title} lead={t.lead} />

      <ul className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {t.items.map((item) => (
          <li key={item.image}>
            <Link
              href={`/${locale}/katalog`}
              className="group block overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-ink-300"
            >
              <div className="aspect-[349/225] overflow-hidden bg-bone-100">
                <Image
                  src={`/images/photos/editorial/${item.image}.jpg`}
                  alt={item.label}
                  width={349}
                  height={225}
                  sizes="(min-width: 1024px) 380px, (min-width: 640px) 45vw, 90vw"
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </div>
              <h3 className="px-5 py-4 font-display text-[15px] font-semibold text-ink-900">
                {item.label}
              </h3>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
