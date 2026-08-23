"use client";

import { useMemo, useState } from "react";
import { useCart } from "./cart-provider";
import type { Dictionary } from "@/lib/i18n";

export type PickerVariant = {
  id: string;
  colourName: string | null;
  colourHex: string | null;
  size: string | null;
  stockQty: number;
  priceDkk: string | null;
};

export function VariantPicker({
  variants,
  dict,
  locale,
}: {
  variants: PickerVariant[];
  dict: Dictionary["shop"]["product"];
  /** A plain string, not a formatter: functions do not cross the RSC boundary. */
  locale: "da" | "en";
}) {
  const money = useMemo(
    () =>
      new Intl.NumberFormat(locale === "da" ? "da-DK" : "en-GB", {
        maximumFractionDigits: 0,
      }),
    [locale],
  );
  const formatPrice = (value: string) => `${money.format(Number(value))} kr.`;

  const { add } = useCart();
  const [colour, setColour] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const colours = useMemo(() => {
    const seen = new Map<string, string | null>();
    for (const v of variants) {
      if (v.colourName && !seen.has(v.colourName)) {
        seen.set(v.colourName, v.colourHex);
      }
    }
    return [...seen.entries()].map(([name, hex]) => ({ name, hex }));
  }, [variants]);

  // Sizes depend on the chosen colour: not every colour is cut in every size,
  // and offering one that does not exist produces a dead end at add-to-cart.
  const sizes = useMemo(() => {
    const pool = colour
      ? variants.filter((v) => v.colourName === colour)
      : variants;
    const seen = new Map<string, number>();
    for (const v of pool) {
      if (v.size) seen.set(v.size, (seen.get(v.size) ?? 0) + v.stockQty);
    }
    return [...seen.entries()].map(([name, stock]) => ({ name, stock }));
  }, [variants, colour]);

  const selected = useMemo(() => {
    return (
      variants.find(
        (v) =>
          (colour === null || v.colourName === colour) &&
          (size === null || v.size === size),
      ) ?? null
    );
  }, [variants, colour, size]);

  const needsColour = colours.length > 0 && colour === null;
  const needsSize = sizes.length > 0 && size === null;
  const outOfStock = selected !== null && selected.stockQty <= 0;
  const canAdd = selected !== null && !needsColour && !needsSize && !outOfStock;

  function onAdd() {
    if (!canAdd || !selected) return;
    add(selected.id, 1);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="mt-6">
      {colours.length > 0 ? (
        <fieldset>
          <legend className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
            {dict.colour}
            {colour ? (
              <span className="ml-2 font-body text-sm font-normal normal-case tracking-normal text-ink-800">
                {colour}
              </span>
            ) : null}
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {colours.map((c) => {
              const on = colour === c.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => {
                    setColour(on ? null : c.name);
                    setSize(null);
                  }}
                  aria-pressed={on}
                  title={c.name}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    on
                      ? "border-ink-900 bg-ink-900 text-bone-50"
                      : "border-border text-ink-700 hover:border-ink-900"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="size-3.5 rounded-full border border-black/15"
                    style={{ backgroundColor: c.hex ?? "#ccc" }}
                  />
                  {c.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {sizes.length > 0 ? (
        <fieldset className="mt-6">
          <legend className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
            {dict.size}
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {sizes.map((s) => {
              const on = size === s.name;
              const soldOut = s.stock <= 0;
              return (
                <button
                  key={s.name}
                  type="button"
                  disabled={soldOut}
                  onClick={() => setSize(on ? null : s.name)}
                  aria-pressed={on}
                  className={`min-w-12 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    on
                      ? "border-ink-900 bg-ink-900 text-bone-50"
                      : "border-border text-ink-700 hover:border-ink-900"
                  } ${soldOut ? "cursor-not-allowed line-through opacity-40" : ""}`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {selected?.priceDkk ? (
        <p className="tabular mt-6 text-2xl font-bold text-ink-900">
          {formatPrice(selected.priceDkk)}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onAdd}
        disabled={!canAdd}
        className="mt-4 w-full rounded-md bg-ink-900 px-6 py-3.5 text-[15px] font-semibold text-bone-50 transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-56"
      >
        {added ? dict.added : dict.addToCart}
      </button>

      <p aria-live="polite" className="mt-2 min-h-5 text-sm text-ink-500">
        {outOfStock
          ? dict.outOfStock
          : needsColour || needsSize
            ? dict.selectFirst
            : ""}
      </p>
    </div>
  );
}
