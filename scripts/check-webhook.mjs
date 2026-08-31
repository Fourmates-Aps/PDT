import "dotenv/config";
import { createHmac, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import postgres from "postgres";

/**
 * The Stripe webhook, end to end, against the real function and the real database.
 *
 *   npm run check:webhook
 *
 * Boots supabase/functions/stripe-webhook with Deno, signs requests the way
 * Stripe does, and checks the three behaviours that decide whether money is
 * recorded correctly:
 *
 *   1. an unsigned or wrongly-signed body is refused — this endpoint is public
 *   2. a valid event is applied exactly once
 *   3. the same event delivered again changes nothing
 *
 * No Stripe account is involved: the signature scheme is HMAC-SHA256 over
 * "<timestamp>.<body>", so a test secret proves the verification path just as
 * well as a live one.
 */

const SECRET = "whsec_" + "t".repeat(32);
// Deno.serve's default. The function does not take a --port flag, and giving
// it one would mean shipping test-only configuration in production code.
const PORT = 8000;
const TAG = "WEBHOOK-TEST";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const sql = postgres(url, { prepare: false, max: 1 });

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

function sign(body, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`, "utf8")
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

async function waitForServer(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      // Any response at all means it is listening; 405 is expected for GET.
      await fetch(`http://127.0.0.1:${PORT}/`, { method: "GET" });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  return false;
}

const server = spawn(
  "deno",
  ["run", "--allow-all", "--config", "deno.json", "stripe-webhook/index.ts"],
  {
    cwd: "supabase/functions",
    env: {
      ...process.env,
      STRIPE_SECRET_KEY: "sk_test_not_used_for_verification",
      STRIPE_WEBHOOK_SECRET: SECRET,
      SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SERVICE_KEY,
      PDT_OPS_EMAIL: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

const logs = [];
server.stdout.on("data", (d) => logs.push(String(d)));
server.stderr.on("data", (d) => logs.push(String(d)));

async function main() {
  if (!(await waitForServer())) {
    console.error("Function did not start:\n" + logs.join(""));
    process.exitCode = 1;
    return;
  }

  const [org] = await sql`select id from organisations limit 1`;
  const [order] = await sql`
    insert into orders (organisation_id, order_number, status, payment_method,
                        account_amount_dkk, personal_amount_dkk, total_dkk)
    values (${org.id}, ${TAG + "-1"}, 'booked', 'split', 400, 250, 650)
    returning id
  `;
  const intent = `pi_${TAG}_${randomUUID().slice(0, 8)}`;
  await sql`select public.create_payment(${order.id}, ${intent}, 250.00, 25000, 'dkk')`;

  const event = {
    id: `evt_${TAG}_${randomUUID().slice(0, 8)}`,
    object: "event",
    type: "payment_intent.succeeded",
    created: Math.floor(Date.now() / 1000),
    data: { object: { id: intent, payment_method_types: ["card"] } },
  };
  const body = JSON.stringify(event);

  const post = (headers) =>
    fetch(`http://127.0.0.1:${PORT}/`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body,
    });

  console.log("\nAuthentication (this endpoint is public — the signature is the auth):");
  const noSig = await post({});
  check("an unsigned request is refused", noSig.status === 400, `status ${noSig.status}`);

  const wrongSig = await post({ "stripe-signature": sign(body, "whsec_" + "x".repeat(32)) });
  check("a wrong signature is refused", wrongSig.status === 400, `status ${wrongSig.status}`);

  const stale = await post({
    "stripe-signature": sign(body, SECRET, Math.floor(Date.now() / 1000) - 3600),
  });
  check("a replayed old timestamp is refused", stale.status === 400, `status ${stale.status}`);

  const tampered = await fetch(`http://127.0.0.1:${PORT}/`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": sign(body, SECRET) },
    body: body.replace(intent, "pi_someone_elses"),
  });
  check("an altered body is refused", tampered.status === 400, `status ${tampered.status}`);

  console.log("\nA genuine event:");
  const good = await post({ "stripe-signature": sign(body, SECRET) });
  const goodBody = await good.json();
  check("accepted", good.status === 200, `status ${good.status}`);
  check("applied to the order", goodBody.applied === true, JSON.stringify(goodBody));

  const [paid] = await sql`
    select status, captured_at, method_detail from payments where provider_ref = ${intent}
  `;
  check("payment marked succeeded", paid?.status === "succeeded", paid?.status);
  check("captured_at stamped", paid?.captured_at !== null);
  check("method recorded", paid?.method_detail === "card", paid?.method_detail);

  console.log("\nRedelivery (Stripe retries until it gets a 2xx):");
  const again = await post({ "stripe-signature": sign(body, SECRET) });
  const againBody = await again.json();
  check("still 200", again.status === 200, `status ${again.status}`);
  check("recognised as a duplicate", againBody.duplicate === true, JSON.stringify(againBody));

  const [count] = await sql`
    select count(*)::int as n from payments where provider_ref = ${intent}
  `;
  check("no second payment row", count.n === 1, `${count.n} rows`);

  console.log("\nAn event for someone else's intent:");
  const stranger = {
    ...event,
    id: `evt_${TAG}_stranger`,
    data: { object: { id: "pi_not_ours_at_all", payment_method_types: ["card"] } },
  };
  const strangerBody = JSON.stringify(stranger);
  const strangerRes = await fetch(`http://127.0.0.1:${PORT}/`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": sign(strangerBody, SECRET),
    },
    body: strangerBody,
  });
  const strangerJson = await strangerRes.json();
  check(
    "acknowledged but not applied",
    strangerRes.status === 200 && strangerJson.applied === false,
    JSON.stringify(strangerJson),
  );

  await sql`delete from stripe_events where id like ${"evt_" + TAG + "%"}`;
  await sql`delete from orders where order_number like ${TAG + "%"}`;
  console.log("\nFixture removed.");
  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  if (failures > 0) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error(error);
  console.error("\nFunction output:\n" + logs.join(""));
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
  await sql.end();
}
