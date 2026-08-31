import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * The payment contract, exercised against the real database.
 *
 *   npm run check:payments
 *
 * These functions are the only way anything writes payments, stripe_events or
 * notification_outbox, and two of the behaviours they guarantee are the sort
 * that only show up under conditions a manual click-through never reproduces:
 * a webhook delivered twice, and two webhooks delivered out of order. Both move
 * money if they are wrong.
 *
 * Seeds its own throwaway order and removes it again.
 */

const TAG = "PAY-TEST";
let failures = 0;

function check(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function one<T extends Record<string, unknown>>(
  query: ReturnType<typeof sql>,
): Promise<T> {
  const rows = await db.execute<T>(query);
  return rows[0] as T;
}

async function main() {
  const [org] = await db.execute<{ id: string }>(sql`select id from organisations limit 1`);
  if (!org) throw new Error("No organisation to test with.");

  const order = await one<{ id: string }>(sql`
    insert into orders (organisation_id, order_number, status, payment_method,
                        account_amount_dkk, personal_amount_dkk, total_dkk)
    values (${org.id}, ${TAG + "-1"}, 'pending_approval', 'split', 500, 120, 620)
    returning id
  `);

  const intent = `pi_${TAG}_${order.id.slice(0, 8)}`;

  console.log("\nWebhook idempotency (Stripe retries until it gets a 2xx):");
  const first = await one<{ record_stripe_event: boolean }>(
    sql`select public.record_stripe_event(${`evt_${TAG}`}, 'payment_intent.succeeded', '{}'::jsonb)`,
  );
  const second = await one<{ record_stripe_event: boolean }>(
    sql`select public.record_stripe_event(${`evt_${TAG}`}, 'payment_intent.succeeded', '{}'::jsonb)`,
  );
  check("first delivery is processed", first.record_stripe_event === true);
  check("redelivery is refused", second.record_stripe_event === false);

  console.log("\nPayment registration:");
  const p1 = await one<{ create_payment: string }>(
    sql`select public.create_payment(${order.id}, ${intent}, 120.00, 12000, 'dkk')`,
  );
  const p2 = await one<{ create_payment: string }>(
    sql`select public.create_payment(${order.id}, ${intent}, 120.00, 12000, 'dkk')`,
  );
  check("same intent yields one payment row", p1.create_payment === p2.create_payment);

  const rejected = await db
    .execute(sql`select public.create_payment(${order.id}, ${intent + "-zero"}, 0, 0, 'dkk')`)
    .then(() => "allowed")
    .catch(() => "rejected");
  check("a zero-amount payment is rejected", rejected === "rejected");

  console.log("\nStatus transitions:");
  const succeeded = await one<{ apply_payment_event: string | null }>(sql`
    select public.apply_payment_event(${intent}, 'succeeded', 'mobilepay', null, now())
  `);
  check("succeeded applies", succeeded.apply_payment_event === order.id);

  const state1 = await one<{ status: string; captured_at: string | null; method_detail: string }>(
    sql`select status, captured_at, method_detail from payments where provider_ref = ${intent}`,
  );
  check("captured_at is stamped", state1.captured_at !== null);
  check("method is recorded", state1.method_detail === "mobilepay", state1.method_detail);

  /*
   * The one that matters. Stripe does not promise ordered delivery, so a
   * `processing` event can land AFTER the `succeeded` it preceded. If that
   * overwrote the status, a paid order would silently become unpaid.
   */
  const late = await one<{ apply_payment_event: string | null }>(sql`
    select public.apply_payment_event(${intent}, 'processing', null, null, now())
  `);
  const state2 = await one<{ status: string }>(
    sql`select status from payments where provider_ref = ${intent}`,
  );
  check("a late earlier event does not apply", late.apply_payment_event === null);
  check("status stays succeeded", state2.status === "succeeded", state2.status);

  const refund = await one<{ apply_payment_event: string | null }>(sql`
    select public.apply_payment_event(${intent}, 'refunded', null, null, now())
  `);
  const state3 = await one<{ status: string; refunded_at: string | null }>(
    sql`select status, refunded_at from payments where provider_ref = ${intent}`,
  );
  check("a refund may follow a success", refund.apply_payment_event === order.id);
  check("refunded_at is stamped", state3.refunded_at !== null);

  const unknown = await one<{ apply_payment_event: string | null }>(sql`
    select public.apply_payment_event('pi_not_ours', 'succeeded', null, null, now())
  `);
  check("an unknown intent is ignored, not an error", unknown.apply_payment_event === null);

  console.log("\nNotification outbox:");
  await db.execute(sql`
    select public.enqueue_notification(${TAG}, ${"test@example.invalid"},
                                       'Test', '{"orderNumber":"X"}'::jsonb, 'da')
  `);
  const badRecipient = await db
    .execute(sql`select public.enqueue_notification(${TAG}, 'not-an-email', 'x', '{}'::jsonb, 'da')`)
    .then(() => "allowed")
    .catch(() => "rejected");
  check("a non-address recipient is rejected", badRecipient === "rejected");

  const claimed = await db.execute<{ id: string; status: string }>(
    sql`select id, status from public.claim_notifications(10) where kind = ${TAG}`,
  );
  const reclaimed = await db.execute<{ id: string }>(
    sql`select id from public.claim_notifications(10) where kind = ${TAG}`,
  );
  check("a pending row is claimed", claimed.length === 1, `${claimed.length} claimed`);
  check("an in-flight row is not claimed twice", reclaimed.length === 0);

  if (claimed[0]) {
    for (let i = 0; i < 5; i++) {
      await db.execute(sql`select public.mark_notification_failed(${claimed[0].id}, 'boom')`);
      await db.execute(sql`select id from public.claim_notifications(10)`);
    }
    const dead = await one<{ status: string; attempts: string }>(
      sql`select status, attempts from notification_outbox where id = ${claimed[0].id}`,
    );
    check("retries stop after 5 attempts", dead.status === "failed", `status ${dead.status}, attempts ${dead.attempts}`);
  }

  console.log("\nWho may call these (definer functions bypass RLS):");
  for (const role of ["anon", "authenticated"]) {
    const [r] = await db.execute<{ can: boolean }>(sql`
      select has_function_privilege(${role},
        'public.apply_payment_event(text, public.payment_status, text, text, timestamptz, text)',
        'execute') as can
    `);
    check(`${role} cannot mark an order paid`, r.can === false);
  }
  const [svc] = await db.execute<{ can: boolean }>(sql`
    select has_function_privilege('service_role',
      'public.apply_payment_event(text, public.payment_status, text, text, timestamptz, text)',
      'execute') as can
  `);
  check("service_role (the Edge Function) can", svc.can === true);

  await db.execute(sql`delete from notification_outbox where kind = ${TAG}`);
  await db.execute(sql`delete from stripe_events where id = ${`evt_${TAG}`}`);
  await db.execute(sql`delete from orders where order_number like ${TAG + "%"}`);
  console.log("\nFixture removed.");
  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  if (failures > 0) process.exitCode = 1;
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => { console.error(e); process.exit(1); });
