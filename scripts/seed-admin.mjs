import "dotenv/config";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * Creates the first platform admin.
 *
 * Chicken-and-egg: every other account is created by invitation from an existing
 * admin, so the first one has to be seeded with the secret key. Run once.
 *
 *   node scripts/seed-admin.mjs you@example.com [password]
 *
 * With no password a strong one is generated and printed once. If the user
 * already exists they are promoted to admin rather than failing, so this is safe
 * to re-run.
 *
 * The role goes in app_metadata, never user_metadata: user_metadata is editable
 * by the user themselves, and every RLS policy here authorises on these claims.
 */
const [, , emailArg, passwordArg] = process.argv;

if (!emailArg) {
  console.error("Usage: node scripts/seed-admin.mjs <email> [password]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SECRET_KEY ?? process.env.SERVICE_KEY;

if (!url || !secret) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SECRET_KEY must be set — see .env.example",
  );
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const generated = !passwordArg;
const password =
  passwordArg ?? `${randomBytes(18).toString("base64url")}Aa1!`;

const admin = createClient(url, secret, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const appMetadata = { role: "admin" };

try {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: appMetadata,
  });

  if (error) {
    const alreadyExists = /already been registered|already exists/i.test(
      error.message,
    );
    if (!alreadyExists) throw error;

    // Promote the existing account instead.
    const { data: list, error: listError } =
      await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listError) throw listError;

    const existing = list.users.find(
      (u) => u.email?.toLowerCase() === email,
    );
    if (!existing) {
      throw new Error(
        `${email} reported as existing but was not found in the user list.`,
      );
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(
      existing.id,
      { app_metadata: appMetadata },
    );
    if (updateError) throw updateError;

    console.log(`Promoted existing user ${email} to platform admin.`);
    console.log(`  user id: ${existing.id}`);
    console.log("\nPassword unchanged. Sign in at /da/login");
    process.exit(0);
  }

  console.log(`Created platform admin ${email}`);
  console.log(`  user id: ${data.user.id}`);
  if (generated) {
    console.log(`\n  password: ${password}`);
    console.log("  ^ shown once — store it in a password manager now.");
  }
  console.log("\nSign in at /da/login");
} catch (error) {
  console.error("Failed:", error.message);
  process.exitCode = 1;
}
