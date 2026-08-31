/**
 * Environment, read once and loudly.
 *
 * A missing secret must fail on the first request with a clear message, not
 * three lines later as `undefined` reaching a signature check — where the
 * failure looks like "Stripe is rejecting us" instead of "nobody set the key".
 *
 * Secrets are set with `supabase secrets set`, never committed. SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY are injected by the Edge runtime itself.
 */
export function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is not set — see supabase/README.md`);
  }
  return value;
}

export function optional(name: string, fallback = ""): string {
  return Deno.env.get(name) ?? fallback;
}
