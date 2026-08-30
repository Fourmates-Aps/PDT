import Image from "next/image";
import { ChevronRight } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import { Container } from "@/components/landing/section";

/**
 * The three-step strip, with the live site's own icons.
 *
 * The icons are drawn white for a dark background, which is why this band is
 * ink rather than bone — using them on a light section would mean recolouring
 * artwork that is not ours to redraw.
 *
 * The chevrons between steps are ours, not images: the live site ships them as
 * two more PNGs, and a decorative arrow does not need a network request.
 */
export function StepsStrip({ dict }: { dict: Dictionary }) {
  const steps = dict.public.steps.items;

  return (
    <div className="bg-ink-900 py-10 text-bone-50 md:py-12">
      <Container>
        <ol className="grid gap-8 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center md:gap-4">
          {steps.map((step, i) => (
            <li
              key={step.title}
              // The chevron is a grid sibling on desktop, so each step keeps its
              // own column and the arrows never wrap onto their own line.
              className="contents"
            >
              <div className="flex items-start gap-4">
                <Image
                  src={`/images/icons/steps/${step.icon}.png`}
                  alt=""
                  width={64}
                  height={64}
                  aria-hidden="true"
                  className="size-12 shrink-0 object-contain"
                />
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-semibold uppercase tracking-[0.08em] text-bone-50">
                    {step.title}
                  </h3>
                  <p className="mt-1 max-w-[34ch] text-sm text-ink-300">
                    {step.body}
                  </p>
                </div>
              </div>

              {i < steps.length - 1 ? (
                <ChevronRight
                  className="hidden size-6 text-highvis-500 md:block"
                  aria-hidden="true"
                />
              ) : null}
            </li>
          ))}
        </ol>
      </Container>
    </div>
  );
}
