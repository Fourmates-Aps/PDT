/**
 * The fulfilment pipeline: one order's journey from booked to delivered.
 *
 * The four stages are DECIDED, not derived — docs/PRODUCT-WORKFLOW-SPEC.md §0
 * D-3 fixes them as Booking → Ankommet på lager → Sendt til tryk/broderi →
 * Leveret, and the same list is used by the employee tracker, the company
 * admin's order list, the warehouse board and the invoice trigger. Nothing is
 * allowed to keep its own copy.
 *
 * Note the shape: goods ARRIVE before they are decorated. PDT buys in per
 * customer order, so "the supplier's parcel landed" is something the customer
 * is genuinely waiting on, and the old approved → print → pack → ship order
 * simply had no step for it.
 *
 * DISPATCH IS NOT A STAGE — Q-C2 (c). The parcel number, the invoice (D-5) and
 * `orders.dispatched_at` are stamped without moving the order, so "Leveret"
 * still means the customer has the parcel rather than that PDT has let go of
 * it. Everything outside the happy path (pending_approval, cancelled,
 * rejected, refunded — Q-C3) is an interruption, not a stage, and never
 * appears on the board.
 */

export const STAGES = [
  "booked",
  "arrived_at_warehouse",
  "sent_to_print",
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
 * `arrived_at_warehouse` has two exits on purpose: an order with no decoration
 * never goes to print, and forcing it through a stage nobody works on is how a
 * board stops being trusted.
 *
 * One step backwards is allowed while the goods are still in the building,
 * because "I moved the wrong card" is more common than any other correction.
 * `delivered` is terminal, and it cannot be reached at all until the parcel has
 * actually been dispatched — see requiresDispatch.
 */
const TRANSITIONS: Record<Stage, readonly Stage[]> = {
  booked: ["arrived_at_warehouse"],
  arrived_at_warehouse: ["sent_to_print", "delivered", "booked"],
  sent_to_print: ["delivered", "arrived_at_warehouse"],
  delivered: [],
};

export function canMove(from: Stage, to: Stage): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStages(from: Stage): readonly Stage[] {
  return TRANSITIONS[from] ?? [];
}

/**
 * `delivered` requires a dispatch to have happened first.
 *
 * Under Q-C2 (c) the parcel number lives on the dispatch event, not on a stage
 * change, so this is what stops an order being marked delivered while it is
 * still on a shelf — the case that loses a parcel.
 */
export function requiresDispatch(to: Stage): boolean {
  return to === "delivered";
}

/**
 * Whether an order can be dispatched from where it stands.
 *
 * Only once the goods are physically here: a `booked` order is still at the
 * supplier, and there is nothing in the building to put in a parcel.
 *
 * TODO(gls): `delivered` is set by hand today. It belongs on a GLS delivery
 * webhook — that is the "GLS confirmation" Q-C2 (c) names.
 */
export function canDispatch(stage: Stage): boolean {
  return stage === "arrived_at_warehouse" || stage === "sent_to_print";
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
 * The date being tracked is the DISPATCH date, so an order that has been
 * dispatched is `done` whatever the calendar says. Since dispatch no longer
 * changes the status, that has to be read from the timestamp rather than from
 * the stage — a red "2 days late" on a parcel already with GLS is noise.
 */
export function dueTone(
  stage: Stage,
  days: number,
  dispatched = false,
): DueTone {
  if (dispatched || stage === "delivered") return "done";
  if (days < 0) return "late";
  if (days <= 1) return "soon";
  return "ok";
}

/**
 * Everything that is not one of the four stages — Q-C3.
 *
 * These are interruptions, not steps: the tracker shows them instead of
 * progress, and they never appear as a board column.
 */
export const INTERRUPTIONS = [
  "pending_approval",
  "cancelled",
  "rejected",
  "refunded",
] as const;

export type Interruption = (typeof INTERRUPTIONS)[number];

/** True for a state the order will not come back from on its own. */
export function isStopped(status: string): boolean {
  return status === "cancelled" || status === "rejected" || status === "refunded";
}

/**
 * How an order's status badge should read, in one place.
 *
 * Three screens showed this and all three had their own copy of the rule, so
 * they drifted the moment the enum changed. Settled means the customer has it;
 * a stopped order reads as a problem; everything else is in progress.
 */
export function orderBadgeTone(
  status: string,
): "secondary" | "destructive" | "outline" {
  if (status === "delivered") return "secondary";
  if (isStopped(status)) return "destructive";
  return "outline";
}
