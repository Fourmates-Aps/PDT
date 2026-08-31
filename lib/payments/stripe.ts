import "server-only";
import Stripe from "stripe";

/**
 * The Stripe client, and the rules about what may go through it.
 *
 * ONLY THE PERSONAL SHARE IS CHARGED. A PDT order can be split: the allowance
 * portion is billed to the company on its payment terms (D-5, invoiced at
 * dispatch) and the overage is the employee's own money. Only the second number
 * reaches Stripe. Sending the total would charge an employee for their
 * employer's goods.
 *
 * The client is created lazily. Importing this module must not require the key
 * to be present — the build renders pages that never take payment, and a missing
 * key should fail at the point money is involved, not at compile time.
 */

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set — see supabase/README.md");
    }
    client = new Stripe(key);
  }
  return client;
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Kroner → øre.
 *
 * Stripe counts in minor units and rejects fractions. Doing this with
 * `amount * 100` on a float gives 12099.999999999998 for 120.9999, so the value
 * is rounded rather than truncated. Money and binary floats have a long history
 * of disagreeing by one øre, and the customer always notices.
 */
export function toMinorUnits(dkk: number | string): number {
  const value = typeof dkk === "string" ? Number(dkk) : dkk;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Not a chargeable amount: ${dkk}`);
  }
  return Math.round(value * 100);
}

/**
 * Create the intent for an order's personal share.
 *
 * `idempotencyKey` is the order id, so a checkout retried after a timeout
 * attaches to the same intent instead of creating a second one the customer
 * would have to be refunded for.
 *
 * Card and MobilePay both run through Stripe; which one the employee picks is
 * their choice at the payment sheet, and is recorded on the payment row when
 * the webhook reports back.
 */
export async function createPersonalPaymentIntent(input: {
  orderId: string;
  orderNumber: string;
  organisationId: string;
  amountDkk: number;
}): Promise<{ id: string; clientSecret: string | null; amountMinor: number }> {
  const amountMinor = toMinorUnits(input.amountDkk);
  if (amountMinor <= 0) {
    throw new Error("No personal amount to charge");
  }

  const intent = await stripe().paymentIntents.create(
    {
      amount: amountMinor,
      currency: "dkk",
      // Let Stripe offer what the account supports — cards and MobilePay in DK.
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        organisationId: input.organisationId,
      },
      description: `Egenbetaling ${input.orderNumber}`,
    },
    { idempotencyKey: `order:${input.orderId}` },
  );

  return {
    id: intent.id,
    clientSecret: intent.client_secret,
    amountMinor,
  };
}
