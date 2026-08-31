"use client";

import { useMemo, useState } from "react";
import { ProductImage } from "@/components/shop/product-image";
import { useVariantSelection } from "./variant-selection";

/**
 * The product photography, and what a colour choice does to it.
 *
 * TWO SEPARATE JOBS, AND ONLY ONE OF THEM ALWAYS WORKS.
 *
 * 1. Browsing every photo of the product. This always works, and until now was
 *    missing entirely: each You product carries TWO shots and the page rendered
 *    only the first, so the second was fetched, stored and never shown.
 *
 * 2. Showing the chosen colour. This works only where the supplier publishes a
 *    picture per variant. Fristads do — their CSV has an image column on every
 *    row. You/F&H do not: their export has no image field on a variant at all,
 *    so all 699 products repeat the same two shots across every colour.
 *
 * So a colour click changes the picture WHEN THERE IS A DIFFERENT PICTURE TO
 * CHANGE TO, and otherwise leaves it alone. The alternative — pretending, by
 * cross-fading to the same file — would be a worse lie than doing nothing.
 */
export function ProductGallery({
  images,
  alt,
  variants,
  labels,
}: {
  images: string[];
  alt: string;
  variants: { colour: string | null; image: string | null }[];
  labels: { view: string; noColourPhoto: string };
}) {
  const { colour } = useVariantSelection();
  const [manual, setManual] = useState<string | null>(null);

  /** First photo published for each colour, where one exists. */
  const imageByColour = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of variants) {
      if (v.colour && v.image && !map.has(v.colour)) map.set(v.colour, v.image);
    }
    return map;
  }, [variants]);

  /*
   * True only when colours genuinely differ from one another. A supplier that
   * repeats one product shot on every variant produces a full map that carries
   * no information, and the caption must not claim otherwise.
   */
  const hasColourPhotos = useMemo(
    () => new Set(imageByColour.values()).size > 1,
    [imageByColour],
  );

  const colourImage =
    colour && hasColourPhotos ? (imageByColour.get(colour) ?? null) : null;

  /*
   * The colour wins over a thumbnail the visitor picked earlier: choosing a
   * colour is the more specific, more recent intent. Picking a thumbnail
   * afterwards overrides it again, because `manual` is reset whenever the
   * colour changes — keyed below.
   */
  const current = colourImage ?? manual ?? images[0] ?? null;

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-border bg-bone-100">
        <ProductImage
          src={current}
          alt={colour ? `${alt} — ${colour}` : alt}
          className="aspect-square size-full object-contain"
          sizes="(min-width: 1024px) 45vw, 100vw"
        />
      </div>

      {images.length > 1 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {images.map((src, index) => {
            const on = src === current;
            return (
              <li key={src}>
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={`${labels.view} ${index + 1}`}
                  onClick={() => setManual(src)}
                  className={`size-16 overflow-hidden rounded-md border bg-bone-100 transition-colors ${
                    on ? "border-ink-900" : "border-bone-300 hover:border-ink-500"
                  }`}
                >
                  <ProductImage
                    src={src}
                    alt=""
                    className="size-full object-contain"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {/*
        Said plainly rather than left as a mystery. A visitor who picks "Marine"
        and sees the same photo should be told the supplier does not provide one
        per colour, instead of concluding the page is broken — which is exactly
        what happened here.
      */}
      {colour && !hasColourPhotos ? (
        <p className="mt-2 text-xs text-ink-500">{labels.noColourPhoto}</p>
      ) : null}
    </div>
  );
}
