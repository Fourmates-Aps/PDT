import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client.
 *
 * DANGER: this key bypasses Row-Level Security entirely. Every call made with it
 * is unauthorised by the database, so the CALLER must do the authorisation —
 * always behind requireRole() in lib/auth/guards.ts.
 *
 * `server-only` makes importing this from a Client Component a build error, which
 * is the guard that matters: leaking this key to the browser would hand every
 * visitor full read/write access to every tenant.
 *
 * Never import this into anything under components/ that is or may become
 * a Client Component.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Newer `sb_secret_…` key preferred; the legacy service-role JWT still works.
  const secret = process.env.SECRET_KEY ?? process.env.SERVICE_KEY;

  if (!url || !secret) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SECRET_KEY must be set — see .env.example",
    );
  }

  return createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
