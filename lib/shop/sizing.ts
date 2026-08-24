/**
 * Size table and size adviser.
 *
 * Numbers are the prototype's standard workwear table. They are advisory: brands
 * cut differently, which is why every surface that uses this also says so. The
 * point is to cut returns, not to promise a fit.
 */

export type SizeRow = {
  size: string;
  eu: string;
  /** Chest circumference in cm, inclusive. */
  chest: [number, number];
  /** Waist circumference in cm, inclusive. */
  waist: [number, number];
};

export const SIZE_TABLE: readonly SizeRow[] = [
  { size: "XS", eu: "44", chest: [86, 90], waist: [74, 78] },
  { size: "S", eu: "46", chest: [90, 94], waist: [78, 82] },
  { size: "M", eu: "48-50", chest: [94, 102], waist: [82, 90] },
  { size: "L", eu: "52-54", chest: [102, 110], waist: [90, 98] },
  { size: "XL", eu: "56-58", chest: [110, 118], waist: [98, 106] },
  { size: "2XL", eu: "60", chest: [118, 126], waist: [106, 114] },
  { size: "3XL", eu: "62", chest: [126, 134], waist: [114, 122] },
];

export const FITS = ["slim", "regular", "loose"] as const;
export type Fit = (typeof FITS)[number];

export function isFit(value: unknown): value is Fit {
  return typeof value === "string" && (FITS as readonly string[]).includes(value);
}

/**
 * Nearest size for a chest measurement.
 *
 * Measurements between two rows resolve upward — a garment slightly too big is
 * wearable, one slightly too small is a return.
 */
export function sizeForChest(chestCm: number, fit: Fit = "regular"): string | null {
  if (!Number.isFinite(chestCm) || chestCm <= 0) return null;

  let index = SIZE_TABLE.findIndex((r) => chestCm <= r.chest[1]);
  if (index === -1) index = SIZE_TABLE.length - 1;

  // Fit shifts one step: slim runs closer to the body, loose leaves room.
  if (fit === "slim") index = Math.max(0, index - 1);
  if (fit === "loose") index = Math.min(SIZE_TABLE.length - 1, index + 1);

  return SIZE_TABLE[index].size;
}

/**
 * Rough chest estimate from height and weight, for employees who have not
 * measured themselves. Deliberately crude and always labelled as an estimate.
 */
export function estimateChest(heightCm: number, weightKg: number): number | null {
  if (!Number.isFinite(heightCm) || !Number.isFinite(weightKg)) return null;
  if (heightCm < 120 || heightCm > 230 || weightKg < 35 || weightKg > 250) {
    return null;
  }
  // Anchored on the middle of the table: 80 kg at 180 cm lands on L (~104 cm).
  return Math.round(104 + (weightKg - 80) * 0.7 + (heightCm - 180) * 0.15);
}

/** Shape stored in organisation_members.measurements. */
export type Measurements = {
  chestCm?: number;
  waistCm?: number;
  heightCm?: number;
  weightKg?: number;
  fit?: Fit;
};

export function parseMeasurements(value: unknown): Measurements | null {
  if (!value || typeof value !== "object") return null;
  const m = value as Record<string, unknown>;
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;

  const parsed: Measurements = {
    chestCm: num(m.chestCm),
    waistCm: num(m.waistCm),
    heightCm: num(m.heightCm),
    weightKg: num(m.weightKg),
    fit: isFit(m.fit) ? m.fit : undefined,
  };

  return Object.values(parsed).some((v) => v !== undefined) ? parsed : null;
}

/**
 * The size to pre-select on a product page.
 *
 * Previous orders beat any calculation: what the employee actually wore and did
 * not return is better evidence than a table. The measurement estimate is only
 * the fallback.
 */
export function recommendSize(input: {
  lastOrderedSize?: string | null;
  measurements?: Measurements | null;
  available: string[];
}): { size: string; source: "history" | "measurements" } | null {
  const has = (s: string | null | undefined) =>
    !!s && input.available.some((a) => a.toLowerCase() === s.toLowerCase());

  if (has(input.lastOrderedSize)) {
    const match = input.available.find(
      (a) => a.toLowerCase() === input.lastOrderedSize!.toLowerCase(),
    )!;
    return { size: match, source: "history" };
  }

  const m = input.measurements;
  const chest =
    m?.chestCm ??
    (m?.heightCm && m?.weightKg ? estimateChest(m.heightCm, m.weightKg) : null);
  if (!chest) return null;

  const suggested = sizeForChest(chest, m?.fit ?? "regular");
  if (!has(suggested)) return null;

  const match = input.available.find(
    (a) => a.toLowerCase() === suggested!.toLowerCase(),
  )!;
  return { size: match, source: "measurements" };
}
