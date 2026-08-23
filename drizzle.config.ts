import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Schema changes prefer DIRECT_URL (session pooler, port 5432) when it is set:
 * DDL and advisory locks are unreliable through the transaction pooler on 6543.
 * DATABASE_URL is the fallback so the project works before DIRECT_URL is filled in.
 */
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error("Set DATABASE_URL (and ideally DIRECT_URL) in .env");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url },
  // Supabase manages anon/authenticated/service_role itself — drizzle-kit must not
  // try to create or drop them.
  entities: {
    roles: { provider: "supabase" },
  },
  // Keep drizzle-kit out of Supabase's own managed schemas.
  schemaFilter: ["public"],
  verbose: true,
  // `strict: true` would prompt for confirmation on every statement, which hangs
  // any non-interactive run. Drizzle still prompts for genuinely destructive
  // changes (drops, renames) without it.
  strict: false,
});
