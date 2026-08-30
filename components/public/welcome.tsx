import Image from "next/image";
import type { Dictionary } from "@/lib/i18n";
import { Section, Eyebrow } from "@/components/landing/section";

/**
 * "Velkommen" — who PDT is, in the visitor's second screenful.
 *
 * The live site pairs this text with a cut-out photograph, which now sits in
 * public/images/photos/welcome.webp along with the rest of their assets. The
 * three facts a B2B visitor actually checks — how long the company has existed,
 * how many places it can be reached, how wide the range is — run underneath the
 * text rather than competing with the picture for the column.
 */
export function Welcome({ dict }: { dict: Dictionary }) {
  const t = dict.public.welcome;

  return (
    <Section>
      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div>
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <h2 className="mt-3 text-h2 font-display font-semibold text-balance text-ink-900">
            {t.title}
          </h2>
          {t.body.map((paragraph) => (
            <p
              key={paragraph}
              className="mt-4 max-w-[58ch] text-pretty text-ink-500"
            >
              {paragraph}
            </p>
          ))}

          <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-bone-200 pt-6">
            {t.stats.map((stat) => (
              <div key={stat.label}>
                <dt className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                  {stat.label}
                </dt>
                <dd className="tabular mt-1 font-display text-h3 font-bold text-ink-900">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/*
          * A cut-out on a transparent background, so it needs no frame — and it
          * is bottom-aligned because the figure is cropped at the hip and would
          * otherwise appear to float.
          */}
        <div className="hidden self-end justify-self-center lg:block">
          <Image
            src="/images/photos/welcome.webp"
            alt=""
            width={239}
            height={415}
            aria-hidden="true"
            sizes="239px"
            className="h-auto w-[239px]"
          />
        </div>
      </div>
    </Section>
  );
}
