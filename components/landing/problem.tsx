import type { Dictionary } from "@/lib/i18n";
import { Section, SectionHead } from "./section";

export function Problem({ dict }: { dict: Dictionary }) {
  return (
    <Section tone="surface">
      <SectionHead
        eyebrow={dict.problem.eyebrow}
        title={dict.problem.title}
        lead={dict.problem.lead}
      />

      <ul className="mt-12 grid gap-px overflow-hidden rounded-lg border border-bone-200 bg-bone-200 sm:grid-cols-2">
        {dict.problem.items.map((item, i) => (
          <li key={item.title} className="bg-bone-50 p-6 sm:p-8">
            <span
              aria-hidden="true"
              className="tabular font-display text-2xl font-bold text-bone-300"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-3 text-h3 font-display font-semibold text-ink-900">
              {item.title}
            </h3>
            <p className="mt-2.5 max-w-[42ch] text-[15px] leading-relaxed text-ink-500">
              {item.body}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
