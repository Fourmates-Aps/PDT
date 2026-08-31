import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Queue a message. Delivery happens elsewhere.
 *
 * Writes to notification_outbox through the same `security definer` function
 * the Edge Functions call — see lib/db/sql/40-payment-functions.sql for why the
 * contract is SQL rather than TypeScript.
 *
 * CALL THIS INSIDE THE TRANSACTION THAT CAUSED THE EVENT. Passing `tx` ties the
 * mail to the write: an order that rolls back never sends a confirmation, and an
 * order that commits always has one queued. Called outside a transaction it
 * still works, it just loses that guarantee.
 *
 * NEVER awaits a mail provider. The supabase `notify` function drains the queue
 * on a schedule, so Resend being down delays mail rather than failing checkout.
 */

export type NotificationKind =
  | "order_placed"
  | "approval_requested"
  | "order_dispatched"
  | "payment_succeeded"
  | "payment_failed"
  | "application_received"
  | "enquiry_received"
  | "import_staged"
  | "import_failed";

type Executor = Pick<typeof db, "execute">;

export async function enqueueNotification(
  executor: Executor,
  input: {
    kind: NotificationKind;
    recipient: string;
    subject: string;
    payload: Record<string, unknown>;
    locale?: "da" | "en";
  },
): Promise<void> {
  await executor.execute(sql`
    select public.enqueue_notification(
      ${input.kind},
      ${input.recipient},
      ${input.subject},
      ${JSON.stringify(input.payload)}::jsonb,
      ${input.locale ?? "da"}
    )
  `);
}

/**
 * Where operational mail goes when there is no specific human to tell.
 *
 * Returns null rather than a fallback address: silently mailing the wrong
 * inbox is worse than not mailing at all, and a missing setting should be
 * visible as "nothing was sent" rather than hidden behind a guess.
 */
export function opsRecipient(): string | null {
  const value = process.env.PDT_OPS_EMAIL?.trim();
  return value && value.includes("@") ? value : null;
}
