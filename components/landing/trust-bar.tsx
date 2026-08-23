import type { Dictionary } from "@/lib/i18n";
import { Container } from "./section";

/** Only verifiable facts appear here — see docs/brand-guidelines.md §5. */
export function TrustBar({ dict }: { dict: Dictionary }) {
  return (
    <div className="bg-ink-900 text-bone-50">
      <Container>
        <dl className="grid grid-cols-2 divide-bone-200/10 sm:grid-cols-4 sm:divide-x">
          {dict.trust.items.map((item) => (
            <div key={item.label} className="px-0 py-5 sm:px-6 sm:first:pl-0">
              <dt className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-highvis-400">
                {item.label}
              </dt>
              <dd className="tabular mt-1.5 text-sm text-bone-50">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </Container>
    </div>
  );
}
