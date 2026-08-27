import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";

/*
 * AUTHORISATION IS NOT DEFINED IN THIS FILE — see organisations.ts.
 *
 * One SELECT policy for platform admins, and deliberately nothing else. With no
 * INSERT, UPDATE or DELETE policy, Postgres denies those to every client — which
 * is what makes the table append-only from the outside. Server-side writes go
 * through Drizzle, which connects as the owner and bypasses RLS.
 */

/**
 * Who did what, when.
 *
 * Required by four separate specifications — every price change, budget change,
 * approval decision, staff change and support access must be traceable
 * (docs/PLATFORM-ADMIN.md rule 2, KAM.md rule 3, CUSTOMER-ADMIN.md rule 4,
 * PRD §5.3). It lands here with the Staff screen because that is the first
 * surface where the rule genuinely bites: a role change is the one edit that can
 * grant somebody access to everything.
 *
 * The actor's email is stored alongside their id ON PURPOSE. Accounts get
 * deactivated and people leave; an audit trail that resolves to a dangling uuid
 * cannot answer the question it exists to answer.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    /** Denormalised so the record survives the account. */
    actorEmail: text("actor_email"),
    /** Dotted machine name, e.g. `staff.role_changed`. */
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    /**
     * A complete, already-composed sentence in Danish.
     *
     * Written at the time of the event rather than reassembled at read time: the
     * names, roles and amounts it refers to change afterwards, and an audit line
     * that silently rewrites itself is worse than none.
     */
    summary: text("summary").notNull(),
    /** Structured detail for anything a sentence cannot carry. */
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_log_created_idx").on(t.createdAt),
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
  ],
).enableRLS();
