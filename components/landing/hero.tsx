import type { Dictionary } from "@/lib/i18n";
import { Container, Eyebrow } from "./section";

/**
 * The hero figure is drawn, not photographed. The brand guidelines rule out borrowed
 * stock lifestyle imagery, and a logo-placement spec communicates the actual product
 * — a garment plus an exact, repeatable logo specification — better than a photo would.
 */
function GarmentSpec({ label, caption }: { label: string; caption: string }) {
  return (
    <figure className="rounded-lg border border-bone-200 bg-bone-100 p-6 sm:p-8">
      <svg
        viewBox="0 0 400 470"
        role="img"
        aria-label={label}
        className="mx-auto h-auto w-full max-w-[340px]"
      >
        {/* garment body */}
        <path
          d="M150 60 L120 73 L58 112 L28 192 L78 216 L98 172 L98 430 L302 430 L302 172 L322 216 L372 192 L342 112 L280 73 L250 60 C238 92 162 92 150 60 Z"
          fill="var(--color-bone-50)"
          stroke="var(--color-ink-300)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* collar */}
        <path
          d="M150 60 C162 92 238 92 250 60"
          fill="none"
          stroke="var(--color-ink-300)"
          strokeWidth="2"
        />
        {/* hem stitch */}
        <path
          d="M98 414 L302 414"
          fill="none"
          stroke="var(--color-ink-200)"
          strokeWidth="1.5"
          strokeDasharray="5 5"
        />

        {/* measurement bracket over the placement */}
        <g stroke="var(--color-ink-400)" strokeWidth="1.25">
          <path d="M222 132 L222 144" />
          <path d="M278 132 L278 144" />
          <path d="M222 138 L278 138" strokeDasharray="4 3" />
        </g>
        <text
          x="250"
          y="126"
          textAnchor="middle"
          className="tabular"
          fill="var(--color-ink-500)"
          fontSize="13"
          fontFamily="var(--font-body)"
        >
          80 × 35 mm
        </text>

        {/* the logo placement itself — left chest, i.e. the viewer's right */}
        <rect
          x="222"
          y="150"
          width="56"
          height="25"
          rx="3"
          fill="var(--color-highvis-500)"
        />

        {/* leader line to the placement name */}
        <g stroke="var(--color-ink-300)" strokeWidth="1.25">
          <path d="M278 162 L330 162" />
          <circle cx="332" cy="162" r="2.5" fill="var(--color-ink-300)" stroke="none" />
        </g>
      </svg>

      <figcaption className="mt-6 border-t border-bone-200 pt-4">
        <p className="tabular font-display text-xs font-semibold uppercase tracking-[0.14em] text-ink-900">
          {label}
        </p>
        <p className="mt-1.5 text-sm text-ink-500">{caption}</p>
      </figcaption>
    </figure>
  );
}

export function Hero({ dict }: { dict: Dictionary }) {
  return (
    <div className="border-b border-bone-200 bg-bone-50 py-14 md:py-24">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <Eyebrow>{dict.hero.eyebrow}</Eyebrow>
            <div className="mt-4 h-[3px] w-14 rounded-sm bg-highvis-500" />
            <h1 className="mt-6 text-display font-display font-bold text-balance text-ink-900">
              {dict.hero.title}
            </h1>
            <p className="mt-6 max-w-[52ch] text-lead text-ink-500">
              {dict.hero.lead}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a
                href="#contact"
                className="rounded-md bg-ink-900 px-6 py-3.5 text-[15px] font-semibold text-bone-50 transition-colors hover:bg-ink-700"
              >
                {dict.hero.ctaPrimary}
              </a>
              <a
                href="#how"
                className="rounded-md border border-bone-300 px-6 py-3.5 text-[15px] font-semibold text-ink-800 transition-colors hover:border-ink-900"
              >
                {dict.hero.ctaSecondary}
              </a>
            </div>
          </div>

          <GarmentSpec
            label={dict.hero.figureLabel}
            caption={dict.hero.figureCaption}
          />
        </div>
      </Container>
    </div>
  );
}
