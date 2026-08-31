import { validateEnquiry, type EnquiryResponse } from "@/lib/enquiries";
import { db } from "@/lib/db";
import { enqueueNotification, opsRecipient } from "@/lib/notifications";
import {
  ENQUIRY_LIMITS,
  PER_EMAIL_LIMIT,
  callerIp,
  hashIp,
  rateLimit,
} from "@/lib/rate-limit";
import {
  createApplication,
  createEnquiry,
  subscribeToNewsletter,
} from "@/lib/db/queries/enquiries";

/**
 * The public front's four forms: contact, callback, B2B application, newsletter.
 *
 * Order of operations matters, and it is cheapest-first on purpose:
 *
 *   1. parse the body            — reject junk before touching anything
 *   2. validate with zod         — pure CPU, no I/O
 *   3. honeypot                  — free, and answers 200 so bots learn nothing
 *   4. rate limit                — one indexed upsert
 *   5. write                     — the only expensive step
 *
 * A flood of malformed requests therefore costs one JSON parse each and never
 * reaches the database. Putting the rate limit first would have every bad
 * request write a counter row, which is the opposite of what it is for.
 *
 * Never statically rendered, and never cached: it mutates.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return json({ ok: false, errors: {} }, 400);
  }

  const { errors, enquiry, issues } = validateEnquiry(body);

  if (!enquiry) {
    // The field map goes to the browser; the reasons stay here. A validation
    // message naming the rule that failed is a map of the rules to anyone
    // probing the endpoint.
    console.info("[enquiry] rejected", { issues });
    return json({ ok: false, errors }, 400);
  }

  // Bots fill every field they find. Answer 200 so the bot does not learn it was
  // caught and retry with the field left blank — but drop the submission.
  if (enquiry.website) {
    console.info("[enquiry] honeypot", { kind: enquiry.kind });
    return json({ ok: true }, 200);
  }

  const ip = callerIp(request.headers);
  const ipHash = hashIp(ip);
  const submitter = {
    ipHash,
    userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
  };

  /*
   * Two ceilings.
   *
   * Per IP catches one machine hammering the form. Per email catches the same
   * applicant arriving from many addresses, which a per-IP limit cannot see.
   * The IP bucket falls back to a shared "unknown" key when there is no usable
   * address — that is deliberately strict: better to throttle a handful of
   * anonymised callers together than to leave an unmetered path open.
   */
  const rule = ENQUIRY_LIMITS[enquiry.kind];
  const perIp = await rateLimit(
    `enquiry:${enquiry.kind}:ip:${ipHash ?? "unknown"}`,
    rule,
  );
  if (!perIp.ok) return tooMany(perIp.retryAfterSeconds);

  const email = "email" in enquiry ? enquiry.email : undefined;
  if (email) {
    const perEmail = await rateLimit(
      `enquiry:${enquiry.kind}:email:${email}`,
      PER_EMAIL_LIMIT,
    );
    if (!perEmail.ok) return tooMany(perEmail.retryAfterSeconds);
  }

  try {
    switch (enquiry.kind) {
      case "application": {
        const result = await createApplication(enquiry, submitter);
        // A duplicate is reported as success — see createApplication for why.
        console.info("[enquiry] application", {
          status: result.status,
          company: enquiry.company,
          cvr: enquiry.cvr,
        });
        break;
      }

      case "newsletter":
        await subscribeToNewsletter(enquiry, submitter);
        break;

      default: {
        const id = await createEnquiry(enquiry, submitter);
        console.info("[enquiry] received", { kind: enquiry.kind, id });
        break;
      }
    }
  } catch (error) {
    console.error("[enquiry] write failed", { kind: enquiry.kind, error });
    return json({ ok: false, errors: {}, message: "storage" }, 500);
  }

  /*
   * Tell somebody. The page promises an answer "within 24 hours on working
   * days", which only holds if a human sees the submission.
   *
   * Queued, never sent inline: the visitor gets their confirmation as soon as
   * the row is written, and a mail provider having a bad afternoon must not
   * turn a stored enquiry into an error page. The supabase `notify` function
   * delivers it.
   *
   * Newsletter sign-ups are deliberately not notified — nobody needs an email
   * per subscriber, and the list is the record.
   *
   * TODO(Q-A3b): this goes to the operations inbox because nothing yet says who
   * reviews B2B applications.
   */
  const ops = opsRecipient();
  if (ops && enquiry.kind !== "newsletter") {
    try {
      await enqueueNotification(db, {
        kind: enquiry.kind === "application"
          ? "application_received"
          : "enquiry_received",
        recipient: ops,
        subject:
          enquiry.kind === "application"
            ? `Ny ansøgning: ${enquiry.company}`
            : `Ny henvendelse fra ${enquiry.name}`,
        payload:
          enquiry.kind === "application"
            ? { company: enquiry.company, contact: enquiry.email, cvr: enquiry.cvr }
            : {
                name: enquiry.name,
                // Truncated: the mail is a prompt to go and look, not the record.
                message: ("message" in enquiry ? enquiry.message : "")?.slice(0, 500) ?? "",
              },
      });
    } catch (error) {
      // The submission is already stored. Failing the request now would tell the
      // visitor their message was lost when it was not.
      console.error("[enquiry] could not queue notification", error);
    }
  }

  return json({ ok: true }, 200);
}

function json(payload: EnquiryResponse, status: number): Response {
  return Response.json(payload, {
    status,
    // Nothing about a form POST should ever be held anywhere.
    headers: { "Cache-Control": "no-store" },
  });
}

function tooMany(retryAfterSeconds: number): Response {
  return Response.json(
    { ok: false, errors: {}, message: "rate_limited" } satisfies EnquiryResponse,
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "Cache-Control": "no-store",
      },
    },
  );
}
