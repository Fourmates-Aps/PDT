"use client";

import { useState } from "react";
import {
  FITS,
  estimateChest,
  sizeForChest,
  type Fit,
} from "@/lib/shop/sizing";
import type { Dictionary } from "@/lib/i18n";

type Result = { size: string | null; estimated: boolean };

/**
 * Chest measurement in, size out.
 *
 * Height and weight are the fallback for people who have not measured
 * themselves, and the answer says so — an estimate presented as a measurement
 * is how you get returns.
 */
export function SizeFinder({
  dict,
}: {
  dict: Dictionary["shop"]["sizeGuide"];
}) {
  const [chest, setChest] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [fit, setFit] = useState<Fit>("regular");
  const [result, setResult] = useState<Result | null>(null);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const chestCm = Number(chest);
    if (Number.isFinite(chestCm) && chestCm > 0) {
      setResult({ size: sizeForChest(chestCm, fit) ?? null, estimated: false });
      return;
    }

    const estimate = estimateChest(Number(height), Number(weight));
    if (estimate) {
      setResult({ size: sizeForChest(estimate, fit) ?? null, estimated: true });
      return;
    }

    setResult({ size: null, estimated: false });
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-semibold text-ink-900">{dict.finderTitle}</h2>
      <p className="mt-1 text-sm text-ink-500">{dict.finderLead}</p>

      <label className="mt-5 block">
        <span className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
          {dict.chest}
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={60}
          max={160}
          value={chest}
          onChange={(e) => setChest(e.target.value)}
          className="mt-2 w-full rounded-sm border border-border bg-bone-50 px-3.5 py-2.5 text-[15px] text-ink-800 transition-colors hover:border-ink-300 focus:border-ink-900 focus:outline-none"
        />
      </label>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
            {dict.height}
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={120}
            max={230}
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            className="mt-2 w-full rounded-sm border border-border bg-bone-50 px-3.5 py-2.5 text-[15px] text-ink-800 transition-colors hover:border-ink-300 focus:border-ink-900 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
            {dict.weight}
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={35}
            max={250}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="mt-2 w-full rounded-sm border border-border bg-bone-50 px-3.5 py-2.5 text-[15px] text-ink-800 transition-colors hover:border-ink-300 focus:border-ink-900 focus:outline-none"
          />
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
          {dict.fit}
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {FITS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFit(f)}
              aria-pressed={fit === f}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                fit === f
                  ? "border-ink-900 bg-ink-900 text-bone-50"
                  : "border-border text-ink-700 hover:border-ink-900"
              }`}
            >
              {dict.fits[f]}
            </button>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        className="mt-5 w-full rounded-md bg-ink-900 px-6 py-3 text-sm font-semibold text-bone-50 transition-colors hover:bg-ink-700 sm:w-auto"
      >
        {dict.suggest}
      </button>

      <div aria-live="polite" className="mt-4 min-h-12">
        {result ? (
          result.size ? (
            <div className="rounded-md border border-success/25 bg-success/5 px-4 py-3">
              <p className="text-[15px] font-semibold text-ink-900">
                {dict.result.replace("{size}", result.size)}
              </p>
              {result.estimated ? (
                <p className="mt-1 text-xs text-ink-500">{dict.estimated}</p>
              ) : null}
            </div>
          ) : (
            <p className="rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-ink-800">
              {dict.noResult}
            </p>
          )
        ) : null}
      </div>
    </form>
  );
}
