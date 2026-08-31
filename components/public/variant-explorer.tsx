"use client";

import { useMemo } from "react";
import { useVariantSelection } from "./variant-selection";

/**
 * Colour and size selection on the public product page.
 *
 * WHY THIS IS A COMPONENT AND NOT TWO LISTS. The page used to render both as
 * `<li>` chips — bordered, padded, with colour swatches, indistinguishable from
 * buttons and completely inert. Anything that looks pressable must be
 * pressable; dead controls that mimic live ones are worse than plain text,
 * because the visitor concludes the site is broken rather than that the feature
 * does not exist.
 *
 * WHAT SELECTING DOES, GIVEN PRICES ARE HIDDEN. Anonymous visitors never see
 * price or stock (BR-39a), so selection cannot show a price the way the shop
 * does. What it can do is what the live site's own product pages do for logged
 * out visitors: confirm which combinations exist, and reveal the supplier's
 * item number for the one chosen. A 38-colour, 12-size style implies 456
 * combinations while only 292 exist — the greying out is real information.
 */

export type ExplorerVariant = {
  colour: string | null;
  size: string | null;
  sku: string | null;
};

export function VariantExplorer({
  colours,
  sizes,
  variants = [],
  labels,
}: {
  colours: { name: string; hex: string | null }[];
  sizes: string[];
  /**
   * Defaulted, and deliberately so. A cached payload written before this field
   * existed arrives as undefined, and iterating it threw a 500 on a page that
   * would otherwise have rendered fine. Cross-filtering is an enhancement; its
   * absence must cost the visitor a feature, not the page.
   */
  variants?: ExplorerVariant[];
  labels: {
    colours: string;
    sizes: string;
    itemNo: string;
    unavailable: string;
    clear: string;
  };
}) {
  // Shared with the gallery, so a colour click can also change the picture.
  const { colour, size, setColour, setSize, clear } = useVariantSelection();

  /* Which sizes each colour comes in, and vice versa. Built once. */
  const { sizesByColour, coloursBySize, skuFor } = useMemo(() => {
    const sizesByColour = new Map<string, Set<string>>();
    const coloursBySize = new Map<string, Set<string>>();
    const skuFor = new Map<string, string>();

    for (const v of variants) {
      if (v.colour && v.size) {
        if (!sizesByColour.has(v.colour)) sizesByColour.set(v.colour, new Set());
        sizesByColour.get(v.colour)!.add(v.size);

        if (!coloursBySize.has(v.size)) coloursBySize.set(v.size, new Set());
        coloursBySize.get(v.size)!.add(v.colour);

        if (v.sku) skuFor.set(`${v.colour}|${v.size}`, v.sku);
      }
    }
    return { sizesByColour, coloursBySize, skuFor };
  }, [variants]);

  /*
   * Cross-filtering runs BOTH ways, so a visitor can start from either end —
   * "what comes in 3XL?" is as reasonable a question as "what sizes are there
   * in Marine?". A one-way filter silently makes one of those impossible.
   */
  const colourAvailable = (name: string) =>
    size === null || (coloursBySize.get(size)?.has(name) ?? false);

  const sizeAvailable = (name: string) =>
    colour === null || (sizesByColour.get(colour)?.has(name) ?? false);

  const selectedSku =
    colour && size ? (skuFor.get(`${colour}|${size}`) ?? null) : null;

  return (
    <>
      {colours.length > 0 ? (
        <section className="mt-7">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
              {labels.colours}
            </h2>
            {colour || size ? (
              <button
                type="button"
                onClick={clear}
                className="text-[11px] text-ink-500 underline underline-offset-2 transition-colors hover:text-ink-900"
              >
                {labels.clear}
              </button>
            ) : null}
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {colours.map((c) => {
              const on = colour === c.name;
              const available = colourAvailable(c.name);
              return (
                <li key={c.name}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={!available}
                    title={available ? undefined : labels.unavailable}
                    onClick={() => setColour(on ? null : c.name)}
                    className={`flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-xs transition-colors ${
                      on
                        ? "border-ink-900 bg-ink-900 text-bone-50"
                        : available
                          ? "border-bone-300 text-ink-700 hover:border-ink-900"
                          : "border-bone-200 text-ink-300 line-through"
                    }`}
                  >
                    {c.hex ? (
                      <span
                        className="size-3.5 shrink-0 rounded-full border border-ink-200"
                        style={{ backgroundColor: c.hex }}
                        aria-hidden="true"
                      />
                    ) : null}
                    {c.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {sizes.length > 0 ? (
        <section className="mt-6">
          <h2 className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
            {labels.sizes}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {sizes.map((s) => {
              const on = size === s;
              const available = sizeAvailable(s);
              return (
                <li key={s}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={!available}
                    title={available ? undefined : labels.unavailable}
                    onClick={() => setSize(on ? null : s)}
                    className={`tabular rounded-sm border px-2.5 py-1.5 text-xs transition-colors ${
                      on
                        ? "border-ink-900 bg-ink-900 text-bone-50"
                        : available
                          ? "border-bone-300 text-ink-700 hover:border-ink-900"
                          : "border-bone-200 text-ink-300 line-through"
                    }`}
                  >
                    {s}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/*
        The item number for the chosen combination — the same thing the live
        site shows as "Model/Varenr." on a logged-out product page. It is what a
        customer quotes on the phone, so it is the one piece of variant detail
        worth revealing without a login.
      */}
      {selectedSku ? (
        <p className="mt-5 rounded-sm border border-bone-300 bg-bone-100 px-3 py-2 text-xs text-ink-700">
          {labels.itemNo}:{" "}
          <span className="tabular font-semibold text-ink-900">{selectedSku}</span>
        </p>
      ) : null}
    </>
  );
}
