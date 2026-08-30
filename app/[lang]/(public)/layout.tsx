import { getDictionary, getLocale } from "@/lib/i18n";
import { listPublicCategories } from "@/lib/db/queries/public-catalogue";
import { UtilityBar } from "@/components/public/utility-bar";
import { StoreHeader } from "@/components/public/store-header";
import { Footer } from "@/components/landing/footer";

/**
 * The public front: front page, range, product pages, about.
 *
 * The one thing that defines this group is what it does NOT do — there is no
 * `getSessionUser` and no redirect. Compare `(shop)/layout.tsx`, which sends
 * anyone without a session to the login page. Everything under here is meant to
 * be reachable by a stranger and by a crawler, which is exactly why the price
 * rule lives in the query layer (lib/db/queries/public-catalogue.ts) rather than
 * in a session check that does not exist here.
 */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dict, locale, categories] = await Promise.all([
    getDictionary(),
    getLocale(),
    // Six is what fits the header row on a laptop before it starts scrolling.
    listPublicCategories(6),
  ]);

  return (
    <>
      <a
        href="#main"
        className="sr-only rounded-md bg-ink-900 px-4 py-2 text-bone-50 focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60]"
      >
        {dict.public.header.skipToContent}
      </a>

      <UtilityBar dict={dict} locale={locale} />
      <StoreHeader
        dict={dict}
        locale={locale}
        categories={categories.map((c) => c.name)}
      />

      <main id="main">{children}</main>

      <Footer dict={dict} locale={locale} />
    </>
  );
}
