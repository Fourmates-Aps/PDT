import type { Dictionary } from "@/lib/i18n";
import { Section, SectionHead } from "./section";

/**
 * Brands are set as type, not logo images. We hold no marks licence for these
 * suppliers, and the brand guidelines forbid presenting the assortment as if it
 * were a set of live technical integrations.
 */
export function Suppliers({ dict }: { dict: Dictionary }) {
  return (
    <Section id="range">
      <SectionHead
        eyebrow={dict.suppliers.eyebrow}
        title={dict.suppliers.title}
        lead={dict.suppliers.lead}
      />

      <ul className="mt-12 flex flex-wrap items-baseline gap-x-6 gap-y-4 border-t border-bone-200 pt-10">
        {dict.suppliers.brands.map((brand, i) => (
          <li key={brand} className="flex items-baseline gap-6">
            {i > 0 ? (
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-sm bg-highvis-500"
              />
            ) : null}
            <span className="font-display text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">
              {brand}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-8 max-w-[52ch] text-sm text-ink-500">
        {dict.suppliers.footnote}
      </p>
    </Section>
  );
}
