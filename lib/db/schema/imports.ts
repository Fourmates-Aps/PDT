import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { organisationMembers } from "./organisations";
import { products } from "./catalogue";

/*
 * AUTHORISATION IS NOT DEFINED IN THIS FILE — see lib/db/sql/10-rls-policies.sql.
 *
 * Both tables are written by the importer, which runs as the database owner and
 * bypasses RLS. The policies govern what a signed-in client may READ: this is
 * supplier data, including cost prices, so it is platform staff only.
 */

/**
 * A feed import never publishes itself.
 *
 * SuuplierIntegration.md asks for exactly this: when a supplier delivers a new
 * catalogue, PDT is notified, and on ACCEPTANCE the newest catalogue replaces the
 * old one. So a run stops at `staged` with its diff recorded, and a human moves
 * it to `published`. An importer that silently rewrites the live catalogue is one
 * bad feed away from emptying the shop.
 */
export const importStatus = pgEnum("import_status", [
  "running",
  /** Fetched, parsed, diffed — waiting for a person. */
  "staged",
  "publishing",
  "published",
  "failed",
  /** A human looked at the diff and said no. */
  "rejected",
]);

export const importChangeType = pgEnum("import_change_type", [
  "created",
  "updated",
  /** In our catalogue, absent from this feed — deactivated, never deleted. */
  "discontinued",
  "unchanged",
]);

export const importRuns = pgTable(
  "import_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Matches `suppliers.supplier_id`, e.g. "FRISTADS". */
    supplierId: text("supplier_id").notNull(),
    status: importStatus("status").notNull().default("running"),
    /**
     * Where the data came from — a remote path or a local file.
     *
     * NEVER a URL with credentials in it. SuuplierIntegration.md is explicit
     * that feed logins belong in a secrets manager, and a connection string
     * pasted into a database column is the opposite of that.
     */
    source: text("source").notNull(),

    /* ---- what the diff found ---- */
    created: integer("created").notNull().default(0),
    updated: integer("updated").notNull().default(0),
    discontinued: integer("discontinued").notNull().default(0),
    unchanged: integer("unchanged").notNull().default(0),
    /** Rows the connector could not use, with the reason. */
    skipped: jsonb("skipped"),

    error: text("error"),

    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    stagedAt: timestamp("staged_at", { withTimezone: true }),
    decidedBy: uuid("decided_by").references(() => organisationMembers.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [index("import_runs_supplier_idx").on(t.supplierId, t.startedAt)],
).enableRLS();

/**
 * One row per product the run would touch, so the diff can be reviewed before
 * anything is applied.
 *
 * `before` and `after` are whole normalised products rather than a field-level
 * delta: a reviewer asking "what changes?" wants to see the product, and storing
 * both sides means publish does not have to re-read the feed.
 *
 * `unchanged` products are counted on the run but NOT written here — that would
 * be 700 rows of noise per import to say nothing happened.
 */
export const importChanges = pgTable(
  "import_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => importRuns.id, { onDelete: "cascade" }),
    changeType: importChangeType("change_type").notNull(),
    supplierSku: text("supplier_sku").notNull(),
    /** Null for a product we have never seen. */
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    before: jsonb("before"),
    after: jsonb("after"),
    /** A short, human sentence: "Pris 249,00 → 269,00 · 2 nye størrelser". */
    summary: text("summary"),
  },
  (t) => [
    index("import_changes_run_idx").on(t.runId, t.changeType),
    index("import_changes_sku_idx").on(t.supplierSku),
  ],
).enableRLS();
