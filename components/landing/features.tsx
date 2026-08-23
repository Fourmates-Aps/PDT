import type { Dictionary } from "@/lib/i18n";
import { Section, SectionHead } from "./section";

export function Features({ dict }: { dict: Dictionary }) {
  return (
    <Section id="solution">
      <SectionHead
        eyebrow={dict.features.eyebrow}
        title={dict.features.title}
        lead={dict.features.lead}
      />

      <ul className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {dict.features.items.map((item) => (
          <li key={item.title}>
            {/* A hairline rule with an accent cap carries the structure — cards and
                drop shadows would make six equal items shout for equal attention. */}
            <div className="flex h-[2px] w-full bg-bone-200">
              <span className="h-full w-10 bg-highvis-500" />
            </div>
            <h3 className="mt-5 text-h3 font-display font-semibold text-ink-900">
              {item.title}
            </h3>
            <p className="mt-2.5 max-w-[40ch] text-[15px] leading-relaxed text-ink-500">
              {item.body}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
