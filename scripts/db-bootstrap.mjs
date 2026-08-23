import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

/**
 * Applies the raw SQL in lib/db/sql/ — the claim-accessor functions that every RLS
 * policy calls. Must run BEFORE `db:push`, because a policy referencing
 * public.auth_org_id() cannot be created until that function exists.
 *
 * Every statement is idempotent (`create or replace`), so re-running is safe.
 */
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL is not set — see .env.example");
  process.exit(1);
}

const dir = join(process.cwd(), "lib", "db", "sql");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.log("No SQL files in lib/db/sql — nothing to do.");
  process.exit(0);
}

const sql = postgres(url, { prepare: false, max: 1 });

try {
  for (const file of files) {
    const contents = readFileSync(join(dir, file), "utf8");
    await sql.unsafe(contents);
    console.log(`applied  ${file}`);
  }
  console.log("\nBootstrap complete.");
} catch (error) {
  console.error("\nBootstrap failed:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
