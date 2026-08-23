import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

/**
 * Demo data for the kunde-admin dashboard.
 *
 *   node scripts/seed-demo.mjs --as you@example.com
 *   node scripts/seed-demo.mjs --clean
 *
 * `--as` attaches an EXISTING signed-up user to the demo organisation as its
 * customer_admin, so you can sign in and see populated pages immediately. It
 * rewrites that user's app_metadata (role + organisation_id).
 *
 * Everything created is marked so --clean can remove exactly this and nothing
 * else: the organisation carries a fixed slug, demo employees use a reserved
 * @demo.pdt.invalid domain (RFC 2606 — unroutable, so no mail can escape), and
 * demo catalogue rows use supplier_id 'DEMO'.
 *
 * NOT run automatically. Nothing here touches real customer data.
 */

const ORG_SLUG = "demo-vognmand-hansen";
const DEMO_DOMAIN = "demo.pdt.invalid";
const DEMO_SUPPLIER = "DEMO";

const args = process.argv.slice(2);
const clean = args.includes("--clean");
const asIndex = args.indexOf("--as");
const asEmail = asIndex >= 0 ? args[asIndex + 1] : null;

const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SECRET_KEY ?? process.env.SERVICE_KEY;

if (!dbUrl || !supabaseUrl || !secret) {
  console.error(
    "DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL and SECRET_KEY must be set — see .env.example",
  );
  process.exit(1);
}

const sql = postgres(dbUrl, { prepare: false, max: 1 });
const admin = createClient(supabaseUrl, secret, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const EMPLOYEES = [
  { name: "Jens Nielsen", dept: "Kolding (lager/chauffører)", allowance: 1500, used: 1180 },
  { name: "Mette Sørensen", dept: "Vejle (kontor)", allowance: 1500, used: 300 },
  { name: "Ali Khan", dept: "Kolding (lager/chauffører)", allowance: 1500, used: 520 },
  { name: "Peter Hansen", dept: "Vejle (kontor)", allowance: 1500, used: 860 },
  { name: "Camilla Berg", dept: "Vejle (kontor)", allowance: 1500, used: 1425 },
  { name: "Thomas Dahl", dept: "Kolding (lager/chauffører)", allowance: 1500, used: 90 },
  { name: "Line Poulsen", dept: "Vejle (kontor)", allowance: 1500, used: 640 },
  { name: "Morten Skov", dept: "Kolding (lager/chauffører)", allowance: 1500, used: 1340 },
];

const slug = (name) =>
  name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "");

async function findUserByEmail(email) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

async function doClean() {
  const [org] = await sql`select id from organisations where slug = ${ORG_SLUG}`;

  if (org) {
    // organisation_members, departments, orders and quotas all cascade from here.
    await sql`delete from organisations where id = ${org.id}`;
    console.log("removed demo organisation and everything scoped to it");
  } else {
    console.log("no demo organisation found");
  }

  await sql`delete from products where supplier_id = ${DEMO_SUPPLIER}`;
  console.log("removed demo catalogue rows");

  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  let removed = 0;
  for (const u of data.users) {
    if (u.email?.endsWith(`@${DEMO_DOMAIN}`)) {
      await admin.auth.admin.deleteUser(u.id).catch(() => {});
      removed += 1;
    }
  }
  console.log(`removed ${removed} demo auth user(s)`);
  console.log("\nClean complete.");
}

async function doSeed() {
  const existing = await sql`select id from organisations where slug = ${ORG_SLUG}`;
  if (existing.length > 0) {
    console.error(
      `Demo organisation already exists. Run with --clean first if you want to reseed.`,
    );
    process.exitCode = 1;
    return;
  }

  const [org] = await sql`
    insert into organisations (slug, name, cvr, city, zip, default_allowance_dkk, order_approval_limit_dkk)
    values (${ORG_SLUG}, 'Vognmand Hansen A/S', '12345678', 'Kolding', '6000', 1500, 1000)
    returning id
  `;
  console.log(`organisation  Vognmand Hansen A/S  (${org.id})`);

  const deptRows = await sql`
    insert into departments (organisation_id, name, budget_dkk, budget_period)
    values
      (${org.id}, 'Vejle (kontor)', 40000, 'annual'),
      (${org.id}, 'Kolding (lager/chauffører)', 65000, 'annual')
    returning id, name
  `;
  const deptByName = Object.fromEntries(deptRows.map((d) => [d.name, d.id]));
  console.log(`departments   ${deptRows.length}`);

  // Catalogue — order lines need a real variant to point at.
  const [product] = await sql`
    insert into products (supplier_id, supplier_sku, brand, name, category, co2_kg, co2_available)
    values (${DEMO_SUPPLIER}, 'DEMO-SOFT-01', 'Demo', 'Softshell-jakke', 'Jakker', 8.40, true)
    returning id
  `;
  const [variant] = await sql`
    insert into product_variants (product_id, ean, colour_name, size, list_price_dkk, stock_qty)
    values (${product.id}, '5700000000001', 'Sort', 'L', 649.00, 40)
    returning id
  `;

  const memberIds = [];
  for (const emp of EMPLOYEES) {
    const email = `${slug(emp.name)}@${DEMO_DOMAIN}`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: `Demo!${Math.random().toString(36).slice(2, 10)}A1`,
      email_confirm: true,
      app_metadata: { role: "employee", organisation_id: org.id },
    });
    if (error) throw new Error(`${email}: ${error.message}`);

    const [member] = await sql`
      insert into organisation_members
        (organisation_id, user_id, role, department_id, full_name, is_active)
      values
        (${org.id}, ${data.user.id}, 'employee', ${deptByName[emp.dept]}, ${emp.name}, true)
      returning id
    `;
    memberIds.push({ id: member.id, ...emp });

    await sql`
      insert into employee_quotas
        (organisation_id, member_id, period_start, period_end, allowance_dkk, used_dkk)
      values
        (${org.id}, ${member.id},
         ${`${new Date().getFullYear()}-01-01`}, ${`${new Date().getFullYear()}-12-31`},
         ${emp.allowance}, ${emp.used})
    `;
  }
  console.log(`employees     ${memberIds.length} (with quotas)`);

  const ORDERS = [
    { n: 1, status: "delivered", total: 1298, pay: "account" },
    { n: 2, status: "shipped", total: 649, pay: "account" },
    { n: 3, status: "in_production", total: 1947, pay: "account" },
    { n: 4, status: "packing", total: 649, pay: "account" },
    { n: 5, status: "pending_approval", total: 1480, pay: "account" },
    { n: 6, status: "pending_approval", total: 1120, pay: "account" },
    { n: 7, status: "pending_approval", total: 2260, pay: "split" },
  ];

  const year = new Date().getFullYear();
  let pendingCount = 0;

  for (const o of ORDERS) {
    const member = memberIds[o.n % memberIds.length];
    const personal = o.pay === "split" ? 260 : 0;
    const account = o.total - personal;

    const [order] = await sql`
      insert into orders
        (organisation_id, member_id, order_number, status, payment_method,
         account_amount_dkk, personal_amount_dkk, total_dkk)
      values
        (${org.id}, ${member.id}, ${`PDT-${year}-${String(9000 + o.n)}`},
         ${o.status}, ${o.pay}, ${account}, ${personal}, ${o.total})
      returning id
    `;

    const qty = Math.max(1, Math.round(o.total / 649));
    await sql`
      insert into order_lines
        (order_id, organisation_id, product_variant_id, quantity,
         unit_price_dkk, line_total_dkk)
      values
        (${order.id}, ${org.id}, ${variant.id}, ${qty}, 649.00, ${qty * 649})
    `;

    if (o.status === "pending_approval") {
      await sql`
        insert into approval_requests (organisation_id, order_id, requested_by, status)
        values (${org.id}, ${order.id}, ${member.id}, 'pending')
      `;
      pendingCount += 1;
    }
  }
  console.log(`orders        ${ORDERS.length} (${pendingCount} awaiting approval)`);

  if (asEmail) {
    const user = await findUserByEmail(asEmail);
    if (!user) {
      console.warn(
        `\n! ${asEmail} not found — sign up or run seed:admin first, then re-run with --as.`,
      );
    } else {
      const { error } = await admin.auth.admin.updateUserById(user.id, {
        app_metadata: { role: "customer_admin", organisation_id: org.id },
      });
      if (error) throw error;

      await sql`
        insert into organisation_members
          (organisation_id, user_id, role, full_name, is_active)
        values (${org.id}, ${user.id}, 'customer_admin', ${asEmail}, true)
        on conflict (organisation_id, user_id) do update
          set role = 'customer_admin', is_active = true
      `;
      console.log(`\nattached      ${asEmail} as customer_admin of the demo org`);
      console.log("Sign out and back in so the new claims land in your token.");
    }
  } else {
    console.log(
      "\nNo --as given: no one is attached to this organisation yet, so the",
    );
    console.log(
      "dashboard will still show empty. Re-run with --as you@example.com",
    );
  }

  console.log("\nSeed complete. Remove it again with: node scripts/seed-demo.mjs --clean");
}

try {
  if (clean) await doClean();
  else await doSeed();
} catch (error) {
  console.error("\nFailed:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
