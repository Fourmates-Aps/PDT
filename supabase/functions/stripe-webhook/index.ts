import Stripe from "stripe";
import { rpc, serviceClient } from "../_shared/db.ts";
import { failed, ok, rejected } from "../_shared/http.ts";
import { required } from "../_shared/env.ts";

/**
 * Stripe → PDT.
 *
 * This is the only endpoint in the system that is open to the internet with no
 * JWT, because Stripe cannot present one. Its authentication is the signature
 * over the raw body, checked before a single field is read. Anything that fails
 * that check is a stranger, whatever it claims about itself in the payload.
 *
 * Three rules hold here, and all three exist because getting them wrong moves
 * money:
 *
 *  1. VERIFY FIRST. The body is untrusted bytes until constructEventAsync
 *     returns. In particular the raw text must be passed exactly as received —
 *     parsing and re-serialising changes the bytes and breaks the signature.
 *  2. ONCE ONLY. Stripe retries until it gets a 2xx and does not promise
 *     exactly-once delivery. record_stripe_event() is asked BEFORE acting.
 *  3. 2xx MEANS "STORED". A 500 asks Stripe to send it again, which is right
 *     when our database is down and wrong when the event is simply not one we
 *     handle — that gets a 200 and no action.
 *
 * ONLY THE PERSONAL SHARE IS HERE. orders.account_amount_dkk is invoiced to the
 * company on its payment terms (D-5) and never reaches Stripe.
 */

// Deno has no Node crypto; Stripe's Web Crypto provider does the HMAC.
const stripe = new Stripe(required("STRIPE_SECRET_KEY"), {
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

/**
 * Stripe's vocabulary → ours.
 *
 * Stripe has a dozen intent statuses; PDT acts on four. Anything unmapped is
 * acknowledged and ignored rather than guessed at.
 */
function mapStatus(eventType: string, intentStatus?: string): string | null {
  switch (eventType) {
    case "payment_intent.succeeded":
      return "succeeded";
    case "payment_intent.payment_failed":
      return "failed";
    case "payment_intent.canceled":
      return "cancelled";
    case "payment_intent.processing":
      return "processing";
    case "charge.refunded":
      return "refunded";
    case "payment_intent.requires_action":
      return "requires_payment";
    default:
      // A status we were handed directly, e.g. from an unfamiliar event that
      // still carries an intent. Trust the map above first.
      return intentStatus === "succeeded" ? "succeeded" : null;
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return rejected("POST only", 405);
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return rejected("Missing stripe-signature");
  }

  // Raw text, not request.json(). Re-serialising changes the bytes the
  // signature was computed over.
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      required("STRIPE_WEBHOOK_SECRET"),
      undefined,
      cryptoProvider,
    );
  } catch (error) {
    // 400, not 500: a bad signature will never verify on a retry, and asking
    // Stripe to resend it for three days helps nobody.
    const message = error instanceof Error ? error.message : String(error);
    console.error("Signature rejected:", message);
    return rejected("Invalid signature");
  }

  const client = serviceClient();

  try {
    const isNew = await rpc<boolean>(client, "record_stripe_event", {
      p_event_id: event.id,
      p_type: event.type,
      p_payload: event as unknown as Record<string, unknown>,
    });

    if (!isNew) {
      console.log(`Duplicate ${event.type} ${event.id} — already applied.`);
      return ok({ received: true, duplicate: true });
    }

    const status = mapStatus(event.type);
    if (!status) {
      // Acknowledged so Stripe stops retrying; recorded above so we can see
      // later what we chose not to act on.
      return ok({ received: true, ignored: event.type });
    }

    // Stripe's union of every object type it can send. We read four fields
    // that are checked individually below, so the cast goes through `unknown`
    // rather than pretending the union is an index signature.
    const object = event.data.object as unknown as Record<string, unknown>;
    // charge.refunded carries a charge, whose payment_intent is the reference
    // every other event uses directly.
    const providerRef = (event.type === "charge.refunded"
      ? (object.payment_intent as string | null)
      : (object.id as string | null)) ?? null;

    if (!providerRef) {
      return ok({ received: true, ignored: "no payment intent on event" });
    }

    const orderId = await rpc<string | null>(client, "apply_payment_event", {
      p_provider_ref: providerRef,
      p_status: status,
      p_method_detail: readMethod(object),
      p_failure_reason: readFailure(object),
      p_occurred_at: new Date(event.created * 1000).toISOString(),
    });

    if (!orderId) {
      // Either an intent belonging to another system on the same Stripe
      // account, or an event that arrived out of order and was correctly
      // refused by the monotonic guard. Neither is an error.
      console.log(`${event.type} ${providerRef} applied to no order.`);
      return ok({ received: true, applied: false });
    }

    if (status === "succeeded" || status === "failed") {
      await queueReceipt(client, orderId, status);
    }

    return ok({ received: true, applied: true });
  } catch (error) {
    // 500 so Stripe retries: this is our side failing, and the event has not
    // been acted on. record_stripe_event is inside the same try for exactly
    // this reason — if it threw, nothing was marked as seen either.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to apply ${event.type} ${event.id}:`, message);
    return failed("Could not process event");
  }
});

function readMethod(object: Record<string, unknown>): string | null {
  const types = object.payment_method_types;
  return Array.isArray(types) && typeof types[0] === "string" ? types[0] : null;
}

function readFailure(object: Record<string, unknown>): string | null {
  const error = object.last_payment_error as { message?: string } | undefined;
  return error?.message ?? null;
}

/**
 * Tell the employee what happened to their money.
 *
 * Queued, not sent: this runs inside a webhook Stripe is timing, and a slow mail
 * provider must not turn into a retried payment event.
 */
async function queueReceipt(
  client: ReturnType<typeof serviceClient>,
  orderId: string,
  status: string,
): Promise<void> {
  const { data } = await client
    .from("orders")
    .select("order_number, personal_amount_dkk")
    .eq("id", orderId)
    .single();

  if (!data) return;

  const recipient = Deno.env.get("PDT_OPS_EMAIL");
  if (!recipient) return;

  await rpc(client, "enqueue_notification", {
    p_kind: status === "succeeded" ? "payment_succeeded" : "payment_failed",
    p_recipient: recipient,
    p_subject:
      status === "succeeded"
        ? `Betaling modtaget — ${data.order_number}`
        : `Betaling mislykkedes — ${data.order_number}`,
    p_payload: {
      orderNumber: data.order_number,
      amountDkk: data.personal_amount_dkk,
    },
    p_locale: "da",
  });
}
