/**
 * Responses.
 *
 * Webhook senders read status codes, not bodies. Stripe retries anything that is
 * not 2xx, so the distinction between "we could not process this" (5xx, please
 * retry) and "this will never be processable" (4xx, stop) decides whether a bad
 * event is redelivered for three days.
 */
export function ok(body: Record<string, unknown> = { received: true }): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

/** Permanent: the sender should not try again. */
export function rejected(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Temporary: our fault, please retry. */
export function failed(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 500,
    headers: { "content-type": "application/json" },
  });
}
