import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organisationMembers, organisations } from "./organisations";

/*
 * AUTHORISATION IS NOT DEFINED IN THIS FILE — see lib/db/sql/10-rls-policies.sql.
 *
 * All three tables are written by the public API route, which connects as the
 * database owner and therefore bypasses RLS. The policies exist to govern what a
 * signed-in CLIENT may read: applications and enquiries are internal sales data,
 * so only platform staff see them, and nobody may write them from the browser.
 */

/**
 * Where an application sits in D-8's review flow.
 *
 * `new` is what the form writes. Everything after it is a human decision, which
 * is why there is no `auto_approved`: Q-A3b (who approves) is still open, and an
 * enum value is the wrong place to answer it.
 */
export const applicationStatus = pgEnum("application_status", [
  "new",
  "in_review",
  "approved",
  "rejected",
]);

export const enquiryKind = pgEnum("enquiry_kind", [
  "contact",
  "callback",
  "newsletter",
]);

/**
 * A company asking for a B2B login — the live site's /ansoeg-om-bruger.
 *
 * Its own table, not a row in `enquiries`, because it is not a message: it is
 * the first step of D-8's onboarding, it has a review lifecycle, and it becomes
 * an `organisations` row if somebody approves it. A contact enquiry is answered
 * and forgotten; this is answered and KEPT.
 *
 * NO PASSWORD COLUMN, deliberately. Their form asks the applicant to choose one.
 * Q-A3a — whether an applicant gets an auth account before a human approves
 * them — is open, and a credential stored before that question is settled is a
 * credential with no defined lifetime, no defined owner and no way to rotate. The
 * approved applicant sets a password from the invitation instead, through the
 * flow that already exists in lib/auth/invites.ts.
 */
export const b2bApplications = pgTable(
  "b2b_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /* ---- what the applicant typed, in the live form's own order ---- */
    company: text("company").notNull(),
    /** CVR. Stored normalised to eight digits — see lib/enquiries.ts. */
    cvr: text("cvr").notNull(),
    ean: text("ean"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    address: text("address").notNull(),
    zipcode: text("zipcode").notNull(),
    city: text("city").notNull(),
    country: text("country").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    newsletter: boolean("newsletter").notNull().default(false),

    /* ---- how it arrived ---- */
    /** Which language the form was filled in — decides the reply's language. */
    locale: text("locale").notNull().default("da"),
    /**
     * SHA-256 of the caller's IP with a server-side salt, never the IP itself.
     *
     * Enough to recognise a flood coming from one source and to answer "was this
     * the same submitter?", without keeping an identifier that is personal data
     * under GDPR and that nobody here has a reason to be able to read back.
     */
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),

    /* ---- review ---- */
    status: applicationStatus("status").notNull().default("new"),
    /** Set when a decision is made; who made it survives the account. */
    reviewedBy: uuid("reviewed_by").references(() => organisationMembers.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    /** Mandatory in the UI on rejection — D-2's rule, applied to applications. */
    reviewNotes: text("review_notes"),
    /** Set on approval, so an approved application points at what it became. */
    organisationId: uuid("organisation_id").references(() => organisations.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("b2b_applications_status_idx").on(t.status, t.createdAt),
    index("b2b_applications_email_idx").on(t.email),
    /*
     * One OPEN application per CVR.
     *
     * Without it, a company that hears nothing back for a week applies again and
     * the review queue grows two rows that must not be approved separately.
     * Partial, so a rejected company can genuinely re-apply later.
     */
    uniqueIndex("b2b_applications_one_open_per_cvr")
      .on(t.cvr)
      .where(sql`status in ('new', 'in_review')`),
  ],
).enableRLS();

/**
 * The other three public forms: contact, callback, newsletter.
 *
 * One table with a `kind` discriminator rather than three, because they differ
 * only in which fields they carry and all three end in the same place — somebody
 * at PDT reading a list and replying. `subject`, `message` and `department` are
 * nullable precisely because a newsletter signup has none of them.
 */
export const enquiries = pgTable(
  "enquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: enquiryKind("kind").notNull(),

    company: text("company"),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    zipcode: text("zipcode"),
    city: text("city"),
    country: text("country"),
    subject: text("subject"),
    /** Which branch the sender picked on the contact form. */
    department: text("department"),
    message: text("message"),
    newsletter: boolean("newsletter").notNull().default(false),

    locale: text("locale").notNull().default("da"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),

    /** Cleared when somebody has actually replied. */
    handledAt: timestamp("handled_at", { withTimezone: true }),
    handledBy: uuid("handled_by").references(() => organisationMembers.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("enquiries_kind_created_idx").on(t.kind, t.createdAt),
    index("enquiries_unhandled_idx")
      .on(t.createdAt)
      .where(sql`handled_at is null`),
    /*
     * One newsletter row per address. A second signup is not an error and must
     * not be shown to the visitor as one — the route upserts instead.
     */
    uniqueIndex("enquiries_one_newsletter_per_email")
      .on(t.email)
      .where(sql`kind = 'newsletter'`),
  ],
).enableRLS();

/**
 * The rate-limit counter store.
 *
 * Postgres rather than Redis on purpose: there is no Redis in this project and
 * no credentials for one, and an in-memory counter is not a rate limit — it
 * resets on every deploy and counts each instance separately, so the real limit
 * is (configured limit × instances). This table is shared by every instance and
 * survives restarts, which is the whole point.
 *
 * Fixed window, not sliding. A sliding window needs a row per request; this needs
 * one row per bucket per window. The known cost is a burst across a window
 * boundary — up to 2× the limit in one instant — which is an acceptable trade
 * against form spam, and nowhere near acceptable for anything metering money.
 *
 * TODO(ops): rows are pruned opportunistically (see lib/rate-limit.ts). If this
 * ever gets real traffic, move that to a scheduled job.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    /** e.g. `enquiry:application:ip:<hash>` — built in lib/rate-limit.ts. */
    bucket: text("bucket").primaryKey(),
    /** Start of the fixed window this count belongs to. */
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [index("rate_limits_window_idx").on(t.windowStart)],
).enableRLS();
