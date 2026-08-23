import "dotenv/config";
import postgres from "postgres";

/**
 * RLS gate.
 *
 * DEV_BRIEF_IMPLEMENTATION_PLAN.md §10.3 specifies a gate that greps
 * supabase/migrations/*.sql for CREATE TABLE without ENABLE ROW LEVEL SECURITY.
 * This project applies schema with `drizzle-kit push`, so there are no migration
 * files to grep. This checks the live database instead — which is strictly
 * stronger, since it verifies the state that actually serves traffic rather than
 * the intent recorded in a file.
 *
 * Fails if any table in `public` has RLS disabled, or has RLS on but no policies
 * (which silently denies everything and looks like a broken app, not a breach).
 */
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL is not set — see .env.example");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });

try {
  const rows = await sql`
    select
      c.relname        as table_name,
      c.relrowsecurity as rls_enabled,
      count(p.polname) as policy_count,
      -- A policy with neither USING nor WITH CHECK has no predicate, and Postgres
      -- then permits every row. drizzle-kit push creates policies in exactly
      -- that shape, so counting policies alone is NOT enough to prove isolation.
      count(p.polname) filter (
        where p.polqual is null and p.polwithcheck is null
      ) as unrestricted_count
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_policy p on p.polrelid = c.oid
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname not like '\\_\\_drizzle%'
    group by c.relname, c.relrowsecurity
    order by c.relname
  `;

  if (rows.length === 0) {
    console.error("No tables found in `public` — has the schema been pushed?");
    process.exitCode = 1;
  }

  const noRls = rows.filter((r) => !r.rls_enabled);
  const noPolicies = rows.filter(
    (r) => r.rls_enabled && Number(r.policy_count) === 0,
  );
  const unrestricted = rows.filter((r) => Number(r.unrestricted_count) > 0);

  for (const r of rows) {
    const bad =
      !r.rls_enabled ||
      Number(r.policy_count) === 0 ||
      Number(r.unrestricted_count) > 0;
    const state = !r.rls_enabled
      ? "RLS DISABLED"
      : Number(r.policy_count) === 0
        ? "no policies"
        : Number(r.unrestricted_count) > 0
          ? `${r.unrestricted_count}/${r.policy_count} policies have NO predicate`
          : `${r.policy_count} policies`;
    console.log(`${bad ? "✗" : "✓"} ${r.table_name.padEnd(24)} ${state}`);
  }

  if (noRls.length > 0) {
    console.error(
      `\nFAIL — RLS disabled on: ${noRls.map((r) => r.table_name).join(", ")}`,
    );
    process.exitCode = 1;
  }

  if (noPolicies.length > 0) {
    console.error(
      `\nFAIL — RLS enabled but no policies (denies everything): ${noPolicies
        .map((r) => r.table_name)
        .join(", ")}`,
    );
    process.exitCode = 1;
  }

  if (unrestricted.length > 0) {
    console.error(
      `\nFAIL — policies with no USING and no WITH CHECK (these permit every row) on: ${unrestricted
        .map((r) => r.table_name)
        .join(", ")}`,
    );
    process.exitCode = 1;
  }

  if (
    noRls.length === 0 &&
    noPolicies.length === 0 &&
    unrestricted.length === 0 &&
    rows.length > 0
  ) {
    console.log(
      `\nOK — ${rows.length} tables, all with RLS enabled and every policy carrying a predicate.`,
    );
  }
} catch (error) {
  console.error("Check failed:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
