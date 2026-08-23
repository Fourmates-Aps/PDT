import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import postgres from "postgres";

/**
 * Applies generated migrations.
 *
 * We use generate + migrate rather than `drizzle-kit push` for two reasons found
 * the hard way against this database:
 *
 *  1. push creates RLS policies WITHOUT their USING / WITH CHECK expressions.
 *     A predicate-less policy permits every row, so pushing produced eleven
 *     tables with RLS "on" and no tenant isolation at all.
 *  2. push introspects the live database before diffing, and drizzle-kit 0.31.10
 *     crashes doing so here (`constraint_definition` comes back undefined).
 *
 * generate diffs against the local snapshot in drizzle/meta instead, so neither
 * problem applies. RLS POLICIES are still applied separately by db:bootstrap —
 * see lib/db/sql/10-rls-policies.sql.
 *
 * `--baseline` records every migration as applied WITHOUT running it. Use it once,
 * on a database whose schema already matches the migrations (which is how this
 * project got here: the first schema was applied with push before the problems
 * above surfaced).
 */
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL is not set — see .env.example");
  process.exit(1);
}

const baseline = process.argv.includes("--baseline");
const sql = postgres(url, { prepare: false, max: 1 });

try {
  if (baseline) {
    const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });

    await sql.unsafe(`create schema if not exists drizzle`);
    await sql.unsafe(`
      create table if not exists drizzle."__drizzle_migrations" (
        id serial primary key,
        hash text not null,
        created_at bigint
      )
    `);

    let recorded = 0;
    for (const m of migrations) {
      const existing = await sql`
        select 1 from drizzle."__drizzle_migrations" where hash = ${m.hash} limit 1
      `;
      if (existing.length > 0) {
        console.log(`already recorded  ${m.hash.slice(0, 12)}…`);
        continue;
      }
      await sql`
        insert into drizzle."__drizzle_migrations" (hash, created_at)
        values (${m.hash}, ${m.folderMillis})
      `;
      recorded += 1;
      console.log(`baselined         ${m.hash.slice(0, 12)}…`);
    }
    console.log(
      `\nBaseline complete — ${recorded} migration(s) recorded as applied, none executed.`,
    );
  } else {
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations applied.");
  }
} catch (error) {
  console.error("\nFailed:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
