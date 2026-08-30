import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { b2bApplications, enquiries } from "@/lib/db/schema";
import type {
  ApplicationEnquiry,
  CallbackEnquiry,
  ContactEnquiry,
  NewsletterEnquiry,
} from "@/lib/enquiries";

/**
 * Writing and reading the public forms' submissions.
 *
 * These run through Drizzle, which connects as the database owner and bypasses
 * RLS. That is the point: the browser never touches these tables directly, so
 * every write passes the schema, the honeypot and the rate limiter in
 * app/api/enquiries/route.ts first.
 */

export type Submitter = {
  ipHash: string | null;
  userAgent: string | null;
};

export type ApplicationResult =
  | { status: "created"; id: string }
  /** A live application already exists for this CVR — see the partial index. */
  | { status: "duplicate" };

/**
 * Record a B2B application.
 *
 * A duplicate is NOT an error to the applicant. Somebody who applied on Monday
 * and hears nothing by Friday will apply again; telling them the submission
 * failed is both untrue and the opposite of helpful. The unique index catches
 * it, the caller reports success, and the review queue stays one row per company.
 */
export async function createApplication(
  input: ApplicationEnquiry,
  submitter: Submitter,
): Promise<ApplicationResult> {
  const [row] = await db
    .insert(b2bApplications)
    .values({
      company: input.company,
      cvr: input.cvr,
      ean: input.ean ?? null,
      firstName: input.firstName,
      lastName: input.lastName,
      address: input.address,
      zipcode: input.zipcode,
      city: input.city,
      country: input.country,
      email: input.email,
      phone: input.phone ?? null,
      newsletter: input.newsletter,
      locale: input.locale,
      ipHash: submitter.ipHash,
      userAgent: submitter.userAgent,
    })
    // Matches `b2b_applications_one_open_per_cvr`.
    .onConflictDoNothing()
    .returning({ id: b2bApplications.id });

  return row ? { status: "created", id: row.id } : { status: "duplicate" };
}

/** Contact and callback both land here; they differ only in which fields exist. */
export async function createEnquiry(
  input: ContactEnquiry | CallbackEnquiry,
  submitter: Submitter,
): Promise<string> {
  const isContact = input.kind === "contact";

  const [row] = await db
    .insert(enquiries)
    .values({
      kind: input.kind,
      company: input.company ?? null,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone,
      address: isContact ? (input.address ?? null) : null,
      zipcode: isContact ? (input.zipcode ?? null) : null,
      city: isContact ? (input.city ?? null) : null,
      country: isContact ? (input.country ?? null) : null,
      subject: isContact ? input.subject : null,
      department: isContact ? (input.department ?? null) : null,
      message: isContact ? input.message : null,
      locale: input.locale,
      ipHash: submitter.ipHash,
      userAgent: submitter.userAgent,
    })
    .returning({ id: enquiries.id });

  return row.id;
}

/**
 * Newsletter signup.
 *
 * Upsert, not insert. Signing up twice is a normal thing for a person to do —
 * they forgot, or they use two browsers — and it must not surface as an error.
 * The unique index is partial (`where kind = 'newsletter'`), so the conflict
 * target has to name the same predicate for Postgres to use it.
 */
export async function subscribeToNewsletter(
  input: NewsletterEnquiry,
  submitter: Submitter,
): Promise<void> {
  await db
    .insert(enquiries)
    .values({
      kind: "newsletter",
      email: input.email,
      newsletter: true,
      locale: input.locale,
      ipHash: submitter.ipHash,
      userAgent: submitter.userAgent,
    })
    .onConflictDoUpdate({
      target: enquiries.email,
      targetWhere: sql`kind = 'newsletter'`,
      set: { locale: input.locale, createdAt: new Date() },
    });
}

/* ------------------------------------------------------------------ */
/* Reads — for the review queue that D-8 still needs                   */
/* ------------------------------------------------------------------ */

/** Applications awaiting a decision, oldest first: a queue, not a feed. */
export async function listOpenApplications(limit = 100) {
  return db
    .select()
    .from(b2bApplications)
    .where(
      and(
        eq(b2bApplications.status, "new"),
        isNull(b2bApplications.reviewedAt),
      ),
    )
    .orderBy(b2bApplications.createdAt)
    .limit(limit);
}

/** Unanswered contact and callback enquiries, newest first. */
export async function listUnhandledEnquiries(limit = 100) {
  return db
    .select()
    .from(enquiries)
    .where(isNull(enquiries.handledAt))
    .orderBy(desc(enquiries.createdAt))
    .limit(limit);
}
