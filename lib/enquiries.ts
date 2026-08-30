/** Shared contract between the public forms and the enquiry route handler. */

export const ENQUIRY_KINDS = ["contact", "application", "newsletter"] as const;
export type EnquiryKind = (typeof ENQUIRY_KINDS)[number];

/**
 * Every field any of the three public forms can send.
 *
 * One flat shape rather than three: the three forms differ only in which fields
 * they show and which are required, and a discriminated union here would mean
 * three validators, three response types and three route branches to keep in
 * step for no gain.
 */
export type EnquiryField =
  | "company"
  | "cvr"
  | "ean"
  | "name"
  | "firstName"
  | "lastName"
  | "address"
  | "zipcode"
  | "city"
  | "country"
  | "phone"
  | "email"
  | "subject"
  | "department"
  | "message";

export type EnquiryInput = Record<EnquiryField, string> & {
  kind: EnquiryKind;
  newsletter: boolean;
  locale: string;
  /** Honeypot — must stay empty. Real users never see this field. */
  website?: string;
};

export type EnquiryResponse =
  | { ok: true }
  | { ok: false; errors: Partial<Record<EnquiryField, true>> };

/** Which fields each form requires. Mirrors the live site's own required marks. */
export const REQUIRED: Record<EnquiryKind, EnquiryField[]> = {
  // profildesigntrading.dk/kontakt marks Navn, Telefon, E-mail, Emne and Besked.
  contact: ["name", "phone", "email", "subject", "message"],
  // /ansoeg-om-bruger marks everything except EAN and Telefonnr.
  application: [
    "company",
    "cvr",
    "firstName",
    "lastName",
    "address",
    "zipcode",
    "city",
    "country",
    "email",
  ],
  newsletter: ["email"],
};

const LIMITS: Partial<Record<EnquiryField, number>> = {
  company: 200,
  cvr: 20,
  ean: 20,
  name: 200,
  firstName: 100,
  lastName: 100,
  address: 200,
  zipcode: 20,
  city: 100,
  country: 100,
  phone: 60,
  email: 320,
  subject: 200,
  department: 100,
  message: 4000,
};

/**
 * Deliberately permissive: one @, a dot in the domain, no spaces. Stricter
 * regexes reject valid addresses, and the only real proof an address works is a
 * reply to it.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Danish CVR numbers are eight digits; spaces and a DK prefix are common. */
const CVR = /^(dk)?\s*\d{8}$/i;

const FIELDS = Object.keys(LIMITS) as EnquiryField[];

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isEnquiryKind(value: unknown): value is EnquiryKind {
  return (
    typeof value === "string" && (ENQUIRY_KINDS as readonly string[]).includes(value)
  );
}

export function validateEnquiry(raw: unknown): {
  errors: Partial<Record<EnquiryField, true>>;
  enquiry: EnquiryInput;
} {
  const body = (raw ?? {}) as Record<string, unknown>;
  const kind = isEnquiryKind(body.kind) ? body.kind : "contact";

  const enquiry = {
    kind,
    newsletter: body.newsletter === true || body.newsletter === "on",
    locale: str(body.locale) || "da",
    website: str(body.website),
  } as EnquiryInput;

  for (const field of FIELDS) {
    enquiry[field] = str(body[field]).slice(0, LIMITS[field] ?? 200);
  }

  const errors: Partial<Record<EnquiryField, true>> = {};

  for (const field of REQUIRED[kind]) {
    if (!enquiry[field]) errors[field] = true;
  }

  if (enquiry.email && !EMAIL.test(enquiry.email)) errors.email = true;
  // Only checked when the form asks for it — a contact enquiry has no CVR field.
  if (REQUIRED[kind].includes("cvr") && enquiry.cvr && !CVR.test(enquiry.cvr)) {
    errors.cvr = true;
  }

  return { errors, enquiry };
}
