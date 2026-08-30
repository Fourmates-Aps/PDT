import {
  REQUIRED,
  validateEnquiry,
  type EnquiryResponse,
} from "@/lib/enquiries";

/**
 * The public front's three forms: contact, B2B application, newsletter.
 *
 * Validation runs here as well as in the browser — the client-side check is a
 * convenience, not a guarantee, since anything can POST to this URL directly.
 *
 * NOTE ON THE APPLICATION FORM. The live site's /ansoeg-om-bruger asks the
 * applicant to choose a password, and this one does not. That is deliberate:
 * D-8 keeps the self-service application, but Q-A3a — does an applicant get an
 * auth account before anyone approves them? — is still open. Collecting a
 * credential before deciding whether it creates an account means storing a
 * password with nowhere to put it, which is the one mistake in this flow that
 * cannot be quietly fixed later. The applicant is invited to set a password
 * from the invitation email once a human has approved them.
 *
 * TODO(integration): deliver these instead of only logging them. Same options
 * as /api/leads — transactional email to PDT sales, or a record via the
 * e-conomic adapter once its API token exists. An application also needs a home
 * in the database: D-8 gives `organisations` an `applied` state and a review
 * queue, neither of which is built. Until then a submitted form is visible only
 * in the server log — do not put these pages in front of real customers.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, errors: {} } satisfies EnquiryResponse,
      { status: 400 },
    );
  }

  const { errors, enquiry } = validateEnquiry(body);

  if (Object.keys(errors).length > 0) {
    return Response.json(
      { ok: false, errors } satisfies EnquiryResponse,
      { status: 400 },
    );
  }

  // Honeypot: bots fill every field they find. Answer 200 so the bot does not
  // learn it was caught and retry with the field left blank — but drop it.
  if (enquiry.website) {
    return Response.json({ ok: true } satisfies EnquiryResponse);
  }

  // Log only the fields this kind of form actually asks for, so a newsletter
  // signup does not print eleven empty strings.
  const fields = Object.fromEntries(
    REQUIRED[enquiry.kind]
      .concat(["company", "phone", "department", "ean", "message"])
      .filter((field, i, all) => all.indexOf(field) === i)
      .map((field) => [field, enquiry[field] || null]),
  );

  console.info("[enquiry]", {
    receivedAt: new Date().toISOString(),
    kind: enquiry.kind,
    locale: enquiry.locale,
    newsletter: enquiry.newsletter,
    ...fields,
  });

  return Response.json({ ok: true } satisfies EnquiryResponse);
}
