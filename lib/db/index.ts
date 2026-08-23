import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Drizzle client.
 *
 * `prepare: false` is REQUIRED: DATABASE_URL points at Supabase's transaction
 * pooler (port 6543), which multiplexes connections and therefore cannot support
 * prepared statements. Removing this flag produces intermittent
 * "prepared statement ... does not exist" errors under load, not a clean failure.
 *
 * This connection authenticates as the database owner and so BYPASSES Row-Level
 * Security. Use it for trusted server-side work — feed imports, cron jobs,
 * migrations. For anything acting on behalf of a signed-in user, go through the
 * Supabase client in lib/supabase/server.ts so their JWT is applied and RLS holds.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set — see .env.example");
}

// Next dev re-evaluates modules on hot reload; without this each reload would open
// a new pool and eventually exhaust the pooler's connection limit.
const globalForDb = globalThis as unknown as {
  __pdtSql?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__pdtSql ??
  postgres(connectionString, {
    prepare: false,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pdtSql = client;
}

export const db = drizzle(client, { schema });
export { schema };
