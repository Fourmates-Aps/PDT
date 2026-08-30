import { publicMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { TERMS } from "@/lib/content/terms";
import { Container } from "@/components/landing/section";

export function generateMetadata() {
  return publicMetadata(() => ({
    title: "Handelsbetingelser",
    description: "Handelsbetingelser for Profil Design Trading ApS.",
  }));
}

/**
 * Handelsbetingelser.
 *
 * Rendered in Danish on both locales. See lib/content/terms.ts: an English
 * translation would be a second legal text nobody has reviewed, which a customer
 * could then rely on. The English page carries a line saying which version
 * governs, and that is the whole difference between the two.
 */
export default async function TermsPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <div className="py-10 md:py-14">
      <Container>
        <div className="max-w-[70ch]">
          <h1 className="text-h2 font-display font-semibold text-ink-900">
            Handelsbetingelser
          </h1>

          {locale === "en" ? (
            <p className="mt-4 rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-ink-800">
              These terms are published in Danish only. The Danish text is the
              one that applies.
            </p>
          ) : null}

          {/* A clause index. Their page has none, and the document is long
              enough that "read the returns clause" means scrolling for it. */}
          <nav className="mt-8 rounded-lg border border-border bg-bone-100/60 px-5 py-4">
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {TERMS.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-sm text-ink-500 underline-offset-2 transition-colors hover:text-ink-900 hover:underline"
                  >
                    {section.heading}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {TERMS.map((section) => (
            <section key={section.id} id={section.id} className="mt-10 scroll-mt-24">
              <h2 className="text-h3 font-display font-semibold text-ink-900">
                {section.heading}
              </h2>
              {section.body.map((paragraph, i) =>
                paragraph.startsWith("- ") ? (
                  <p
                    key={i}
                    className="mt-1.5 pl-4 text-[15px] leading-relaxed text-ink-700"
                  >
                    {paragraph.slice(2)}
                  </p>
                ) : (
                  <p
                    key={i}
                    className="mt-3 text-[15px] leading-relaxed text-ink-700"
                  >
                    {paragraph}
                  </p>
                ),
              )}
            </section>
          ))}

          <p className="mt-12 border-t border-border pt-5 text-xs text-ink-500">
            {dict.footer.company} · {dict.footer.cvr}
          </p>
        </div>
      </Container>
    </div>
  );
}
