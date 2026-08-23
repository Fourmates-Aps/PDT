import type { Dictionary } from "@/lib/i18n";
import { Section, SectionHead } from "./section";

export function HowItWorks({ dict }: { dict: Dictionary }) {
  return (
    <Section id="how" tone="surface">
      <SectionHead eyebrow={dict.how.eyebrow} title={dict.how.title} />

      <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
        {dict.how.steps.map((step) => (
          <li key={step.n} className="relative pt-8">
            <span className="absolute top-0 left-0 h-[2px] w-full bg-bone-300" />
            <span className="absolute top-0 left-0 h-[2px] w-12 bg-highvis-500" />
            <span
              aria-hidden="true"
              className="tabular font-display text-[42px] leading-none font-bold text-bone-300"
            >
              {step.n}
            </span>
            <h3 className="mt-4 text-h3 font-display font-semibold text-ink-900">
              {step.title}
            </h3>
            <p className="mt-2.5 max-w-[40ch] text-[15px] leading-relaxed text-ink-500">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
