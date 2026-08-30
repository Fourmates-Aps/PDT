import Image from "next/image";
import type { Dictionary } from "@/lib/i18n";
import { Container } from "@/components/landing/section";

/**
 * The five promises, with the live site's icons.
 *
 * These replace the earlier text-only trust bar. The facts it carried are not
 * lost: CVR, the showrooms and the ex-VAT note all live in the footer, and the
 * delivery window is the first promise's subtitle.
 *
 * The icons are dark line art, so this band stays light — the mirror image of
 * the steps strip above it.
 */
export function Promises({ dict }: { dict: Dictionary }) {
  return (
    <div className="border-t border-bone-200 bg-bone-50 py-10">
      <Container>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {dict.public.promises.items.map((promise) => (
            <li key={promise.label} className="text-center">
              <Image
                src={`/images/icons/promises/${promise.icon}.png`}
                alt=""
                width={48}
                height={48}
                aria-hidden="true"
                className="mx-auto size-10 object-contain"
              />
              <p className="mt-3 font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-900">
                {promise.label}
              </p>
              <p className="mt-1 text-xs text-ink-500">{promise.sub}</p>
            </li>
          ))}
        </ul>
      </Container>
    </div>
  );
}
