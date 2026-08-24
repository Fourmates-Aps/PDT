"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart } from "./cart-provider";
import {
  LOGO_METHODS,
  LOGO_PLACEMENTS,
  embellishmentCost,
  placementSurcharge,
  sortLogos,
  type CartLogo,
  type LogoMethod,
  type LogoPlacement,
} from "@/lib/shop/logo";
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
  logoDict,
  locale,
  displayMode,
  pointsLabel,
  recommended,
  sizeGuideHref,
}: {
  variants: PickerVariant[];
  dict: Dictionary["shop"]["product"];
  logoDict: Dictionary["shop"]["logo"];
  /** A plain string, not a formatter: functions do not cross the RSC boundary. */
  locale: "da" | "en";
  displayMode: "price" | "points";
  pointsLabel: string;
  /** Size to pre-select, and why — see lib/shop/sizing.ts. */
  recommended: { size: string; source: "history" | "measurements" } | null;
  sizeGuideHref: string;
}) {
  const money = useMemo(
    () =>
      new Intl.NumberFormat(locale === "da" ? "da-DK" : "en-GB", {
        maximumFractionDigits: 0,
      }),
    [locale],
  );
  const amount = (value: number | string) =>
    displayMode === "points"
      ? `${money.format(Math.round(Number(value)))} ${pointsLabel}`
      : `${money.format(Number(value))} kr.`;

  const { add } = useCart();
  const [colour, setColour] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(recommended?.size ?? null);
  const [logos, setLogos] = useState<Partial<Record<LogoPlacement, LogoMethod>>>(
    {},
  );
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

  /*
   * A pre-selected size — from history or a size recommendation — can stop
   * existing once a colour narrows the list. That is DERIVED here rather than
   * corrected by an effect that calls setState: syncing two pieces of state
   * costs an extra render pass and gets out of step on the first one.
   */
  const effectiveSize =
    size && sizes.some((s) => s.name === size && s.stock > 0) ? size : null;

  const selected = useMemo(() => {
    return (
      variants.find(
        (v) =>
          (colour === null || v.colourName === colour) &&
          (effectiveSize === null || v.size === effectiveSize),
      ) ?? null
    );
  }, [variants, colour, effectiveSize]);

  const chosenLogos: CartLogo[] = useMemo(
    () =>
      (Object.entries(logos) as [LogoPlacement, LogoMethod][]).map(
        ([placement, method]) => ({ placement, method }),
      ),
    [logos],
  );

  const decoration = embellishmentCost(chosenLogos);
  const garment = selected?.priceDkk ? Number(selected.priceDkk) : 0;

  // Exactly one placement is included in the garment price: the first in the
  // canonical order, so the total does not depend on tap order.
  const freePlacement = sortLogos(chosenLogos)[0]?.placement ?? null;

  const needsColour = colours.length > 0 && colour === null;
  const needsSize = sizes.length > 0 && effectiveSize === null;
  const outOfStock = selected !== null && selected.stockQty <= 0;
  const canAdd = selected !== null && !needsColour && !needsSize && !outOfStock;

  function togglePlacement(placement: LogoPlacement) {
    setLogos((current) => {
      const next = { ...current };
      if (next[placement]) delete next[placement];
      else next[placement] = "embroidery";
      return next;
    });
  }

  function setMethod(placement: LogoPlacement, method: LogoMethod) {
    setLogos((current) => ({ ...current, [placement]: method }));
  }

  function onAdd() {
    if (!canAdd || !selected) return;
    add(selected.id, 1, chosenLogos.length ? chosenLogos : undefined);
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
                  onClick={() => setColour(on ? null : c.name)}
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
          <legend className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
            {dict.size}
            <Link
              href={sizeGuideHref}
              className="font-body text-xs font-medium normal-case tracking-normal text-ink-500 underline underline-offset-2 hover:text-ink-900"
            >
              {dict.sizeGuideLink}
            </Link>
            {recommended ? (
              <span className="rounded-sm bg-highvis-50 px-2 py-0.5 font-body text-[11px] font-semibold normal-case tracking-normal text-highvis-700">
                {recommended.source === "history"
                  ? dict.fromHistory
                  : dict.recommended}
                : {recommended.size}
              </span>
            ) : null}
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {sizes.map((s) => {
              const on = effectiveSize === s.name;
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

      <fieldset className="mt-8 rounded-lg border border-border p-4">
        <legend className="px-1.5 font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
          {logoDict.title}
        </legend>
        <p className="text-xs text-ink-500">{logoDict.hint}</p>

        <ul className="mt-3 flex flex-col gap-2">
          {LOGO_PLACEMENTS.map((placement) => {
            const method = logos[placement];
            const on = method !== undefined;
            /*
             * "Included" is only ever shown on the placement that IS included.
             * Showing it on all four while nothing is selected would read as
             * "all four are free" rather than "the first one you pick is".
             */
            const free = on && placement === freePlacement;

            return (
              <li
                key={placement}
                className={`rounded-md border px-3 py-2.5 transition-colors ${
                  on ? "border-ink-900 bg-highvis-50/40" : "border-border"
                }`}
              >
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => togglePlacement(placement)}
                    className="size-4 accent-ink-900"
                  />
                  <span className="text-sm font-semibold text-ink-900">
                    {logoDict.placements[placement]}
                  </span>
                  <span className="tabular ml-auto text-xs text-ink-500">
                    {free
                      ? logoDict.included
                      : `+ ${amount(placementSurcharge(placement, method ?? "embroidery"))}`}
                  </span>
                </label>

                {on ? (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-7">
                    <span className="sr-only">{logoDict.method}</span>
                    {LOGO_METHODS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMethod(placement, m)}
                        aria-pressed={method === m}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          method === m
                            ? "border-ink-900 bg-ink-900 text-bone-50"
                            : "border-border text-ink-700 hover:border-ink-900"
                        }`}
                      >
                        {logoDict.methods[m]}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-xs leading-relaxed text-ink-500">
          {logoDict.manualNote}
        </p>
      </fieldset>

      {selected?.priceDkk ? (
        <dl className="mt-6 space-y-1">
          {decoration > 0 ? (
            <>
              <div className="flex justify-between text-sm">
                <dt className="text-ink-500">{dict.garmentPrice}</dt>
                <dd className="tabular text-ink-800">{amount(garment)}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-ink-500">{dict.logoPrice}</dt>
                <dd className="tabular text-ink-800">+ {amount(decoration)}</dd>
              </div>
            </>
          ) : null}
          <div className="flex items-baseline justify-between pt-1">
            <dt className="sr-only">{dict.inclLogo}</dt>
            <dd className="tabular text-2xl font-bold text-ink-900">
              {amount(garment + decoration)}
            </dd>
          </div>
        </dl>
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
