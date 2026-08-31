import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { required } from "./env.ts";

/**
 * The service-role client.
 *
 * These functions never SELECT or UPDATE application tables directly. They call
 * the `security definer` functions in lib/db/sql/40-payment-functions.sql, which
 * are the shared contract with the Next app — see the header there for why.
 *
 * The service role bypasses RLS entirely, so this key must never be sent to a
 * browser and no value derived from a request may be used to choose which
 * function runs.
 */
export function serviceClient(): SupabaseClient {
  return createClient(
    required("SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/** Call one of the contract functions, turning a Postgres error into a throw. */
export async function rpc<T>(
  client: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) {
    throw new Error(`${fn} failed: ${error.message}`);
  }
  return data as T;
}
