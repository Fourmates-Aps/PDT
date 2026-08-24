/**
 * The fulfilment pipeline: one order's journey from approved to delivered.
 *
 * The prototype draws this as a five-column kanban (Design/godkendelse →
 * Tryk/broderi → Pakning → Klar → Leveret). Those columns map onto the
 * `order_status` enum we already have, so the board is a view of real order
 * state rather than a second copy of it that can drift.
 *
 * Everything before `approved` belongs to the customer's approval flow, and
 * everything after `delivered` (cancelled, refunded) is an exception, not a
 * stage — neither appears on the board.
 */

export const STAGES = [
  "approved",
  "in_production",
  "packing",
  "shipped",
  "delivered",
] as const;

export type Stage = (typeof STAGES)[number];

export function isStage(value: unknown): value is Stage {
  return typeof value === "string" && (STAGES as readonly string[]).includes(value);
}

export function stageIndex(stage: Stage): number {
  return STAGES.indexOf(stage);
}

/**
 * Which stages an order may move to next.
 *
 * `approved` has two exits on purpose: an order with no decoration skips
 * print/embroidery entirely and goes straight to packing. Forcing it through a
 * production stage nobody works on is how a board stops being trusted.
 *
 * One step backwards is allowed while the goods are still in the building,
 * because "I moved the wrong card" is more common than any other correction.
 * Nothing moves back out of `shipped`: the parcel has left, and pretending
 * otherwise loses the tracking number.
 */
const TRANSITIONS: Record<Stage, readonly Stage[]> = {
  approved: ["in_production", "packing"],
  in_production: ["packing", "approved"],
  packing: ["shipped", "in_production"],
  shipped: ["delivered"],
  delivered: [],
};

export function canMove(from: Stage, to: Stage): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStages(from: Stage): readonly Stage[] {
  return TRANSITIONS[from] ?? [];
}

/** Moving into `shipped` needs a parcel number — see shipOrderAction. */
export function requiresParcelNumber(to: Stage): boolean {
  return to === "shipped";
}

/**
 * Expected dispatch date, derived — NOT stored.
 *
 * The public site promises 2–4 working days, so an order is treated as due on
 * the third working day after it was placed. There is no deadline column on
 * `orders` yet; deriving one from a stated rule is honest, whereas seeding
 * fake per-order deadlines to make a board look busy is not.
 *
 * TODO(production): once orders carry a real agreed delivery date (from the
 * quote, or from the supplier's lead time per line), read that instead.
 */
export const LEAD_TIME_WORKING_DAYS = 3;

export function expectedDispatch(
  placedAt: Date,
  workingDays = LEAD_TIME_WORKING_DAYS,
): Date {
  const date = new Date(placedAt);
  let left = workingDays;
  while (left > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) left -= 1;
  }
  return date;
}

/** Whole days from `now` until the date; negative once it has passed. */
export function daysUntil(date: Date, now = new Date()): number {
  const a = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / 86_400_000);
}

export type DueTone = "late" | "soon" | "ok" | "done";

/**
 * How a card's due date should read.
 *
 * An order already shipped or delivered is `done` whatever the date says —
 * a red "2 days late" on a parcel the customer has in their hands is noise.
 */
export function dueTone(stage: Stage, days: number): DueTone {
  if (stage === "shipped" || stage === "delivered") return "done";
  if (days < 0) return "late";
  if (days <= 1) return "soon";
  return "ok";
}
