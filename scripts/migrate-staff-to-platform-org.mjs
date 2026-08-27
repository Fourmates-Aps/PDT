import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

/**
 * Moves PDT's own staff onto the platform organisation.
 *
 *   node scripts/migrate-staff-to-platform-org.mjs [--apply]
 *
 * WHY THIS IS NEEDED
 *
 * Before the Staff screen existed, staff accounts were created by scripts and
 * ended up in three different shapes: some inside a CUSTOMER organisation, some
 * with no organisation at all, and some correct. A platform admin sitting inside
 * a customer company is exactly what docs/PLATFORM-ADMIN.md forbids — and it is
 * also a live authorisation hazard, because the customer-scoped policies read
 * organisation_id from the token.
 *
 * This moves every account whose role is admin, key_account_manager or warehouse
 * onto the platform organisation, in both places that matter:
 *   1. organisation_members — what the dashboards read
 *   2. app_metadata.organisation_id — what RLS reads
 *
 * Dry run by default. Pass --apply to write.
 */

const apply = process.argv.includes("--apply");

const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SECRET_KEY ?? process.env.SERVICE_KEY;

if (!dbUrl || !supabaseUrl || !secret) {
  console.error(
    "DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL and SECRET_KEY must be set — see .env.example",
  );
  process.exit(1);
}

const STAFF_ROLES = ["admin", "key_account_manager", "warehouse"];

const sql = postgres(dbUrl, { prepare: false, max: 2 });
const admin = createClient(supabaseUrl, secret, {
  auth: { autoRefreshToken: false, persistSession: false },
});

try {
  const [platform] = await sql`
    select id, name from organisations where is_platform = true limit 1
  `;

  if (!platform) {
    console.error(
      "No platform organisation found. Run `npm run db:bootstrap` first.",
    );
    process.exit(1);
  }

  console.log(`Platform organisation: ${platform.name} (${platform.id})\n`);

  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw error;

  const staff = data.users.filter((u) =>
    STAFF_ROLES.includes(u.app_metadata?.role),
  );

  if (staff.length === 0) {
    console.log("No staff accounts found.");
    process.exit(0);
  }

  let moved = 0;

  for (const user of staff) {
    const role = user.app_metadata.role;
    const currentOrg = user.app_metadata.organisation_id ?? null;
    const correct = currentOrg === platform.id;

    const [membership] = await sql`
      select m.id, o.name as org_name, o.is_platform
      from organisation_members m
      join organisations o on o.id = m.organisation_id
      where m.user_id = ${user.id}
      limit 1
    `;

    const where = membership
      ? membership.is_platform
        ? "platform"
        : `customer "${membership.org_name}"`
      : "no membership row";

    if (correct && membership?.is_platform) {
      console.log(`  ok    ${role.padEnd(20)} ${user.email}`);
      continue;
    }

    console.log(
      `  MOVE  ${role.padEnd(20)} ${user.email}  (${where}, token org ${currentOrg ?? "none"})`,
    );
    moved += 1;

    if (!apply) continue;

    if (membership) {
      await sql`
        update organisation_members
        set organisation_id = ${platform.id}
        where id = ${membership.id}
      `;
    } else {
      await sql`
        insert into organisation_members (organisation_id, user_id, role, full_name, is_active)
        values (${platform.id}, ${user.id}, ${role}, ${user.email.split("@")[0]}, true)
        on conflict (organisation_id, user_id) do nothing
      `;
    }

    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, organisation_id: platform.id },
    });
  }

  console.log(
    `\n${moved} account(s) ${apply ? "moved" : "would move"}. ${
      apply ? "" : "Re-run with --apply to write."
    }`,
  );

  if (apply && moved > 0) {
    console.log(
      "Moved users must sign out and in again — their token still carries the old organisation.",
    );
  }
} finally {
  await sql.end();
}
