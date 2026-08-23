import type { Dictionary } from "@/lib/i18n";
import { Section, SectionHead } from "./section";

/** The single dark section on the page — it anchors the composition and gives the
    accent one place to sit at full strength. */
export function Esg({ dict }: { dict: Dictionary }) {
  return (
    <Section id="esg" tone="ink">
      <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:gap-16">
        <div>
          <SectionHead
            eyebrow={dict.esg.eyebrow}
            title={dict.esg.title}
            tone="dark"
          />
          <p className="mt-6 max-w-[54ch] text-lead text-ink-300">
            {dict.esg.body}
          </p>
          <p className="mt-5 max-w-[54ch] border-l-2 border-highvis-500 pl-4 text-sm leading-relaxed text-ink-300">
            {dict.esg.disclaimer}
          </p>
        </div>

        <ul className="flex flex-col justify-center gap-px self-start overflow-hidden rounded-lg bg-ink-800">
          {dict.esg.points.map((point) => (
            <li
              key={point}
              className="flex items-center gap-4 bg-ink-900 px-6 py-5"
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-sm bg-highvis-500"
              />
              <span className="text-[15px] text-bone-50">{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
