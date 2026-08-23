import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import postgres from "postgres";

/**
 * Phase 1 verification against DEV_BRIEF_IMPLEMENTATION_PLAN.md §1 and §5.
 *
 * Checks the live database and the repository, and prints PASS/FAIL/GAP per
 * item. A GAP is something the brief requires that is genuinely not built yet —
 * reported as such rather than quietly passed.
 *
 *   node scripts/verify-phase1.mjs
 */

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const sql = postgres(url, { prepare: false, max: 1 });

let pass = 0;
let fail = 0;
let gap = 0;

const P = (label, detail = "") => {
  pass += 1;
  console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
};
const F = (label, detail = "") => {
  fail += 1;
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
};
const G = (label, detail = "") => {
  gap += 1;
  console.log(`  GAP   ${label}${detail ? ` — ${detail}` : ""}`);
};
const head = (s) => console.log(`\n${s}\n${"-".repeat(s.length)}`);

/* ---------------------------------------------------------------- */
head("§1.1  Multi-tenancy — organisation_id everywhere");

// Tables the brief scopes per tenant. products/product_variants are shared
// supplier master data by the brief's own SQL — see lib/db/schema/catalogue.ts.
const TENANT_TABLES = [
  "departments",
  "organisation_members",
  "org_assortment",
  "org_pricing",
  "employee_quotas",
  "orders",
  "order_lines",
  "approval_requests",
];

const cols = await sql`
  select table_name, column_name
  from information_schema.columns
  where table_schema = 'public' and column_name = 'organisation_id'
`;
const haveOrgId = new Set(cols.map((c) => c.table_name));
const missing = TENANT_TABLES.filter((t) => !haveOrgId.has(t));
missing.length === 0
  ? P("every tenant-scoped table carries organisation_id", `${TENANT_TABLES.length} tables`)
  : F("organisation_id missing", missing.join(", "));

/* ---------------------------------------------------------------- */
head("§1.1 / §3  Row-Level Security");

const rls = await sql`
  select c.relname tbl, c.relrowsecurity enabled,
         count(p.polname)::int policies,
         count(p.polname) filter (where p.polqual is null and p.polwithcheck is null)::int open
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policy p on p.polrelid = c.oid
  where n.nspname='public' and c.relkind='r' and c.relname not like '\\_\\_drizzle%'
  group by c.relname, c.relrowsecurity order by c.relname
`;
const noRls = rls.filter((r) => !r.enabled).map((r) => r.tbl);
const noPol = rls.filter((r) => r.enabled && r.policies === 0).map((r) => r.tbl);
const openPol = rls.filter((r) => r.open > 0).map((r) => r.tbl);

noRls.length === 0
  ? P("RLS enabled on every table", `${rls.length} tables`)
  : F("RLS disabled", noRls.join(", "));
noPol.length === 0 ? P("every table has policies") : F("no policies", noPol.join(", "));
openPol.length === 0
  ? P("no predicate-less policies", `${rls.reduce((s, r) => s + r.policies, 0)} policies total`)
  : F("policies permit every row", openPol.join(", "));

/* ---------------------------------------------------------------- */
head("§3  Claim helper functions");

const fns = await sql`
  select p.proname, p.prosecdef
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname in ('auth_org_id','auth_user_role')
`;
const names = fns.map((f) => f.proname);
names.includes("auth_org_id") && names.includes("auth_user_role")
  ? P("claim accessors deployed", "public.auth_org_id(), public.auth_user_role()")
  : F("claim accessors missing", `found: ${names.join(", ") || "none"}`);

// The brief specifies SECURITY DEFINER; we deliberately did not.
fns.every((f) => !f.prosecdef)
  ? P("accessors are not SECURITY DEFINER", "least privilege — they only read the JWT")
  : F("accessor runs as definer unnecessarily");

/* ---------------------------------------------------------------- */
head("§2  Phase 1 schema");

const PHASE1 = [
  "organisations", "organisation_members", "departments",
  "products", "product_variants", "org_assortment", "org_pricing",
  "employee_quotas", "orders", "order_lines", "approval_requests",
];
const tables = (await sql`
  select table_name from information_schema.tables
  where table_schema='public' and table_type='BASE TABLE'
`).map((t) => t.table_name);
const missingTables = PHASE1.filter((t) => !tables.includes(t));
missingTables.length === 0
  ? P("all Phase 1 tables present", `${PHASE1.length} tables`)
  : F("tables missing", missingTables.join(", "));

// Integrity constraints that the money logic depends on.
const checks = (await sql`
  select con.conname from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and con.contype='c'
`).map((c) => c.conname);
checks.includes("orders_amounts_sum_to_total")
  ? P("DB enforces account + personal = total")
  : F("split total constraint missing");
checks.includes("order_lines_quantity_positive")
  ? P("DB enforces positive order line quantity")
  : F("quantity constraint missing");

const [seq] = await sql`
  select 1 from pg_class where relkind='S' and relname='order_number_seq'
`;
seq ? P("order number sequence exists", "concurrency-safe numbering") : F("order number sequence missing");

/* ---------------------------------------------------------------- */
head("§1.2  Auth & roles");

const [enumRow] = await sql`
  select array_agg(e.enumlabel order by e.enumsortorder) labels
  from pg_type t join pg_enum e on e.enumtypid=t.oid where t.typname='member_role'
`;
const roles = enumRow?.labels ?? [];
const WANT = ["employee","customer_admin","key_account_manager","warehouse","admin"];
WANT.every((r) => roles.includes(r))
  ? P("five roles defined in the database", roles.join(", "))
  : F("role enum mismatch", roles.join(", "));

const src = (f) => (existsSync(f) ? readFileSync(f, "utf8") : "");
const rolesTs = src("lib/auth/roles.ts");
rolesTs.includes("app_metadata")
  ? P("roles read from app_metadata", "server-controlled, not user-editable")
  : F("roles not sourced from app_metadata");

// Match the CALL specifically. A bare "getSession" substring also hits our own
// getSessionUser() helper and the comments warning against the real thing.
const authSources = [
  "lib/supabase/server.ts",
  "proxy.ts",
  "lib/auth/guards.ts",
  "app/[lang]/accept-invite/actions.ts",
]
  .map(src)
  .join("\n");
authSources.includes("auth.getUser()") && !authSources.includes("auth.getSession(")
  ? P("authorisation uses auth.getUser(), never auth.getSession()", "token verified with the auth server, not just decoded from the cookie")
  : F("auth.getSession() used for authorisation");

existsSync("proxy.ts")
  ? P("route guards present", "proxy.ts — Next 16 replacement for middleware")
  : F("no proxy.ts / middleware");

/* ---------------------------------------------------------------- */
head("§1.3  Integrations as a swappable module layer");

existsSync("lib/integrations")
  ? P("lib/integrations/ exists")
  : G("lib/integrations/ not created", "no adapters written yet — Phase 4 work, but the brief wants the seam from the start");

/* ---------------------------------------------------------------- */
head("§1.4 / §1.5  AI generation logging, cache, rate limit");

tables.includes("ai_generation_log")
  ? P("ai_generation_log table present")
  : G("ai_generation_log not created", "brief wants it 'from commit one'; the AI fitting room itself is Phase 2");

/* ---------------------------------------------------------------- */
head("§5.2  Product catalogue requirements");

const shopSrc = src("lib/db/queries/shop.ts") + src("app/[lang]/(shop)/shop/page.tsx");
shopSrc.includes("orgAssortment") ? P("catalogue scoped to org assortment") : F("assortment scoping missing");
shopSrc.includes("orgPricing") ? P("prices come from org_pricing") : F("per-org pricing missing");
shopSrc.includes("co2Available") ? P("CO2 shown only where the supplier discloses it") : F("CO2 handling missing");
shopSrc.includes("category") ? P("category filter present") : F("category filter missing");

const [cat] = await sql`select count(*)::int n from products`;
const [vars] = await sql`select count(*)::int n from product_variants`;
cat.n > 0 ? P("catalogue populated", `${cat.n} products, ${vars.n} variants`) : G("catalogue empty");

/* ---------------------------------------------------------------- */
head("§5.3  Split payment");

const actions = src("app/[lang]/(shop)/actions.ts");
actions.includes("priceVariants") && actions.includes("Math.min(remaining, total)")
  ? P("split computed server-side from live quota")
  : F("split logic not server-authoritative");
actions.includes("TODO(payment)")
  ? G("MobilePay webhook not implemented", "split is recorded; no charge, no idempotent webhook — explicitly stubbed")
  : G("MobilePay integration status unclear");

const [orderCount] = await sql`select count(*)::int n from orders`;
const [badSplit] = await sql`
  select count(*)::int n from orders
  where account_amount_dkk + personal_amount_dkk <> total_dkk
`;
badSplit.n === 0
  ? P("every order's split reconciles", `${orderCount.n} orders checked`)
  : F("orders with broken split", `${badSplit.n}`);

/* ---------------------------------------------------------------- */
head("§5.5  Customer admin capabilities");

existsSync("lib/auth/invites.ts") ? P("employee invitation flow") : F("invite flow missing");
existsSync("app/[lang]/dashboard/customer/clothing-account/page.tsx")
  ? P("quota management") : F("quota management missing");
existsSync("app/[lang]/dashboard/customer/approvals/page.tsx")
  ? P("approval queue") : F("approval queue missing");

const invites = src("lib/auth/invites.ts");
invites.includes("app_metadata")
  ? P("invite writes role to app_metadata", "not user_metadata — brief §4.3 has this wrong")
  : F("invite writes role to the wrong place");

/* ---------------------------------------------------------------- */
head("§5.6  KAM 3-step onboarding");

const onboardingSrc =
  src("app/[lang]/dashboard/kam/onboarding/page.tsx") +
  src("components/dashboard/org-onboarding.tsx") +
  src("app/[lang]/dashboard/actions.ts");

onboardingSrc.includes("createOrganisationAction")
  ? P("organisation creation + admin invite exists")
  : F("no organisation onboarding");

existsSync("app/[lang]/dashboard/kam/onboarding/page.tsx")
  ? P("onboarding reachable by a KAM", "/dashboard/kam/onboarding — not behind the admin-only prefix")
  : F("KAM cannot reach customer onboarding");

// Check for the actual integration, not merely that some file exists — the
// previous version of this check passed as soon as the page was created.
onboardingSrc.includes("cvrapi")
  ? P("CVR auto-lookup wired")
  : G("no CVR auto-lookup", "brief §5.6 step 1 wants cvrapi.dk auto-fill; fields are manual today");
onboardingSrc.includes("org_assortment") || onboardingSrc.includes("orgAssortment")
  ? P("assortment selection step present")
  : G("no assortment step in onboarding", "brief §5.6 step 2; assortment is seeded, not chosen in the wizard");
src("lib/db/schema/organisations.ts").includes("minimumDgPct")
  ? G("minimum-DG stored but not enforced", "column exists; no guardrail blocking activation below it")
  : G("minimum-DG guardrail missing");

/* ---------------------------------------------------------------- */
head("§5.1  Route map coverage");

// Brief route -> file that implements it. Locale segment is ours: the brief
// predates the bilingual requirement, so every route sits under /[lang].
const ROUTE_MAP = {
  "/login": "app/[lang]/login/page.tsx",
  "/shop": "app/[lang]/(shop)/shop/page.tsx",
  "/shop/[productSlug]": "app/[lang]/(shop)/shop/[slug]/page.tsx",
  "/cart": "app/[lang]/(shop)/cart/page.tsx",
  "/checkout": "app/[lang]/(shop)/checkout/page.tsx",
  "/orders": "app/[lang]/(shop)/orders/page.tsx",
  "/orders/[orderNumber]": "app/[lang]/(shop)/orders/[orderNumber]/page.tsx",
  "/dashboard/customer/": "app/[lang]/dashboard/customer/page.tsx",
  "/dashboard/customer/employees": "app/[lang]/dashboard/customer/employees/page.tsx",
  "/dashboard/customer/departments": "app/[lang]/dashboard/customer/departments/page.tsx",
  "/dashboard/customer/budgets": "app/[lang]/dashboard/customer/clothing-account/page.tsx",
  "/dashboard/customer/approvals": "app/[lang]/dashboard/customer/approvals/page.tsx",
  "/dashboard/customer/orders": "app/[lang]/dashboard/customer/orders/page.tsx",
  "/dashboard/kam/onboarding": "app/[lang]/dashboard/kam/onboarding/page.tsx",
  "/dashboard/kam/": "app/[lang]/dashboard/kam/page.tsx",
  "/dashboard/kam/pipeline": "app/[lang]/dashboard/kam/pipeline/page.tsx",
  "/dashboard/admin/": "app/[lang]/dashboard/admin/page.tsx",
  "/dashboard/admin/orgs": "app/[lang]/dashboard/admin/orgs/page.tsx",
  "/dashboard/admin/catalogs": "app/[lang]/dashboard/admin/catalogs/page.tsx",
  "/dashboard/admin/pricing": "app/[lang]/dashboard/admin/pricing/page.tsx",
  "/dashboard/admin/roles": "app/[lang]/dashboard/admin/roles/page.tsx",
};

const built = Object.entries(ROUTE_MAP).filter(([, f]) => existsSync(f));
const notBuilt = Object.entries(ROUTE_MAP).filter(([, f]) => !existsSync(f));
P(`${built.length}/${Object.keys(ROUTE_MAP).length} brief routes implemented`);
if (notBuilt.length > 0) {
  G("routes not built", notBuilt.map(([r]) => r).join(", "));
}

/* ---------------------------------------------------------------- */
head("§10  CI/CD");

existsSync(".github/workflows") ? P("CI workflows present") : G("no .github/workflows", "no lint/typecheck/RLS gate running on PRs");
existsSync("scripts/check-rls.mjs") ? P("RLS gate script exists", "npm run db:check") : F("no RLS gate");

/* ---------------------------------------------------------------- */
console.log(`\n${"=".repeat(56)}`);
console.log(`PASS ${pass}   FAIL ${fail}   GAP ${gap}`);
console.log("=".repeat(56));
if (fail > 0) process.exitCode = 1;
await sql.end();
