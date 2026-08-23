import { validateLead, type LeadResponse } from "@/lib/leads";

/**
 * Lead capture endpoint.
 *
 * Validation runs here as well as in the browser — the client-side check is a
 * convenience, not a guarantee, since anything can POST to this URL directly.
 *
 * Note: `next/root-params` is not available in Route Handlers, so the locale
 * arrives in the request body rather than being read from the route.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, errors: {} } satisfies LeadResponse,
      { status: 400 },
    );
  }

  const { errors, lead } = validateLead(body);

  if (Object.keys(errors).length > 0) {
    return Response.json(
      { ok: false, errors } satisfies LeadResponse,
      { status: 400 },
    );
  }

  // Honeypot: bots fill every field they find. Answer 200 so the bot does not
  // learn it was caught and retry with the field left blank — but drop the lead.
  if (lead.website) {
    return Response.json({ ok: true } satisfies LeadResponse);
  }

  // TODO(integration): deliver the lead instead of only logging it. Options, in the
  // order they were discussed: transactional email to PDT sales, or a debtor/contact
  // record via the e-conomic REST adapter once its API token exists. Until one of
  // those is wired up, a submitted form is only visible in the server log — do not
  // put this page in front of real customers before that is done.
  console.info("[lead]", {
    receivedAt: new Date().toISOString(),
    company: lead.company,
    name: lead.name,
    email: lead.email,
    phone: lead.phone || null,
    employees: Number(lead.employees),
    message: lead.message || null,
    locale: lead.locale,
  });

  return Response.json({ ok: true } satisfies LeadResponse);
}
