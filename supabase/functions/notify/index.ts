import { rpc, serviceClient } from "../_shared/db.ts";
import { failed, ok, rejected } from "../_shared/http.ts";
import { optional, required } from "../_shared/env.ts";
import { render } from "./templates.ts";

/**
 * Drains the notification outbox.
 *
 * WHY AN OUTBOX AND NOT A SEND. Enqueuing happens inside the transaction that
 * caused it, so an order that commits always has its mail and an order that
 * rolls back never sends one. Delivery is a separate step, here — which means a
 * mail provider being down delays mail instead of failing checkout.
 *
 * Called by pg_cron on a schedule. Overlapping runs are safe:
 * claim_notifications() hands out rows with `for update skip locked`, so a
 * second tick steps over what the first is holding rather than sending it twice.
 *
 * Each row is settled individually. One address that bounces must not strand
 * the other twenty-four in the batch.
 */

type Outbox = {
  id: string;
  kind: string;
  recipient: string;
  locale: string;
  subject: string;
  payload: Record<string, unknown>;
};

const BATCH = 25;

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return rejected("POST only", 405);

  const client = serviceClient();

  let batch: Outbox[];
  try {
    batch = await rpc<Outbox[]>(client, "claim_notifications", { p_limit: BATCH });
  } catch (error) {
    return failed(error instanceof Error ? error.message : String(error));
  }

  if (!batch || batch.length === 0) {
    return ok({ claimed: 0, sent: 0, failed: 0 });
  }

  let sent = 0;
  let failures = 0;

  for (const row of batch) {
    try {
      await deliver(row);
      await rpc(client, "mark_notification_sent", { p_id: row.id });
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Back to pending for another attempt, or `failed` after five — the SQL
      // function decides, so the retry policy is not duplicated here.
      await rpc(client, "mark_notification_failed", {
        p_id: row.id,
        p_error: message.slice(0, 500),
      });
      failures++;
      console.error(`Notification ${row.id} (${row.kind}) failed: ${message}`);
    }
  }

  return ok({ claimed: batch.length, sent, failed: failures });
});

/**
 * Hand one message to the mail provider.
 *
 * Resend over plain fetch rather than an SDK: this is one POST, and a
 * dependency that has to be audited and version-pinned for one POST is a poor
 * trade in a function that handles customer data.
 */
async function deliver(row: Outbox): Promise<void> {
  const apiKey = required("RESEND_API_KEY");
  const from = optional("PDT_MAIL_FROM", "Profil Design Trading <no-reply@profildesigntrading.dk>");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [row.recipient],
      subject: row.subject,
      html: render(row.kind, row.locale, row.payload),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend ${response.status}: ${detail.slice(0, 300)}`);
  }
}
