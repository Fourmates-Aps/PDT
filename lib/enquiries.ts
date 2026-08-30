import { z } from "zod";

/**
 * The contract behind every public form: contact, callback, application,
 * newsletter.
 *
 * ONE definition, imported by both the browser and the route handler. The client
 * runs it to answer a typo without a round trip; the server runs it again because
 * anything can POST to the endpoint and the client's opinion is not evidence.
 * Two copies of these rules would drift the first time a field changed.
 *
 * No server-only imports here, deliberately — this file is pulled into a client
 * bundle, so a `server-only` or database import would break the build.
 */

export const ENQUIRY_KINDS = [
  "contact",
  "callback",
  "application",
  "newsletter",
] as const;
export type EnquiryKind = (typeof ENQUIRY_KINDS)[number];

/* ------------------------------------------------------------------ */
/* Field primitives                                                    */
/* ------------------------------------------------------------------ */

const trimmed = (max: number) => z.string().trim().max(max);

/** Required free text: a value that is only whitespace is not a value. */
const required = (max: number, label: string) =>
  trimmed(max).min(1, { error: `${label} er påkrævet` });

/** Optional free text. "" and undefined both mean "not given". */
const optional = (max: number) =>
  trimmed(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/**
 * Deliberately permissive: one @, a dot in the domain, no spaces. Stricter
 * patterns reject valid addresses, and the only real proof an address works is
 * a reply reaching it. Lower-cased so the newsletter's unique index treats
 * Anna@x.dk and anna@x.dk as the same person.
 */
const email = z
  .string()
  // Trim and lower-case BEFORE the format check, not after: people paste
  // addresses with a trailing space, and " a@b.dk " is a valid address typed by
  // a real person, not a malformed one.
  .transform((v) => v.trim().toLowerCase())
  .pipe(z.email({ error: "Ugyldig e-mailadresse" }).max(320));

/**
 * A Danish CVR is eight digits. People type "DK 12 34 56 78", so the input is
 * normalised to bare digits BEFORE the length is checked — otherwise a correctly
 * written number gets rejected for its spaces.
 */
const cvr = z
  .string()
  .trim()
  .transform((v) => v.replace(/^dk/i, "").replace(/\D/g, ""))
  .refine((v) => v.length === 8, { error: "CVR-nummer skal være 8 cifre" });

/** EAN/GLN is 13 digits when given at all. */
const ean = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v === "" || v.length === 13, {
    error: "EAN-nummer skal være 13 cifre",
  })
  .transform((v) => (v ? v : undefined))
  .optional();

/**
 * Phone numbers are not validated beyond "plausibly a phone number".
 *
 * They arrive with spaces, dots, +45, brackets and country codes from three
 * countries. A regex tight enough to be meaningful rejects real numbers, and the
 * cost of a wrong number here is one failed callback, not a security hole.
 */
const hasDigits = (v: string) => /\d{6,}/.test(v.replace(/\D/g, ""));

const phone = (isRequired: boolean) => {
  // A missing field and an empty one are the same thing to a person filling in
  // a form, so both become "" before any rule runs. Without this, leaving a
  // required phone blank failed on the TYPE ("expected string, received
  // undefined") and showed the visitor a message about types.
  const normalised = z
    .string()
    .max(40)
    .optional()
    .transform((v) => (v ?? "").trim());

  return isRequired
    ? normalised.refine(hasDigits, { error: "Telefonnummer er påkrævet" })
    : normalised
        .refine((v) => v === "" || hasDigits(v), {
          error: "Ugyldigt telefonnummer",
        })
        .transform((v) => (v ? v : undefined));
};

/** Only the two locales that exist; anything else falls back rather than throws. */
const locale = z
  .enum(["da", "en"])
  .catch("da")
  .default("da");

/**
 * The honeypot.
 *
 * Not an error when filled — see the route. A bot that learns it was caught
 * simply retries with the field left blank.
 */
const website = z.string().max(200).optional();

const base = { locale, website };

/* ------------------------------------------------------------------ */
/* One schema per form                                                 */
/* ------------------------------------------------------------------ */

export const contactSchema = z.object({
  kind: z.literal("contact"),
  ...base,
  company: optional(200),
  name: required(200, "Navn"),
  address: optional(200),
  zipcode: optional(20),
  city: optional(100),
  country: optional(100),
  phone: phone(true),
  email,
  subject: required(200, "Emne"),
  department: optional(100),
  message: required(4000, "Besked"),
});

export const callbackSchema = z.object({
  kind: z.literal("callback"),
  ...base,
  company: optional(200),
  name: required(200, "Navn"),
  email: email.optional(),
  phone: phone(true),
});

export const applicationSchema = z.object({
  kind: z.literal("application"),
  ...base,
  company: required(200, "Firmanavn"),
  cvr,
  ean,
  firstName: required(100, "Fornavn"),
  lastName: required(100, "Efternavn"),
  address: required(200, "Adresse"),
  zipcode: required(20, "Postnummer"),
  city: required(100, "By"),
  /* Their form offers exactly these three markets. */
  country: z.enum(["Danmark", "Schweiz", "Tyskland"], {
    error: "Vælg et land",
  }),
  email,
  phone: phone(false),
  newsletter: z
    .union([z.boolean(), z.literal("on"), z.literal("")])
    .optional()
    .transform((v) => v === true || v === "on"),
});

export const newsletterSchema = z.object({
  kind: z.literal("newsletter"),
  ...base,
  email,
  newsletter: z.literal(true).catch(true).default(true),
});

export const enquirySchema = z.discriminatedUnion("kind", [
  contactSchema,
  callbackSchema,
  applicationSchema,
  newsletterSchema,
]);

export type Enquiry = z.infer<typeof enquirySchema>;
export type ContactEnquiry = z.infer<typeof contactSchema>;
export type CallbackEnquiry = z.infer<typeof callbackSchema>;
export type ApplicationEnquiry = z.infer<typeof applicationSchema>;
export type NewsletterEnquiry = z.infer<typeof newsletterSchema>;

/* ------------------------------------------------------------------ */
/* What the UI needs                                                   */
/* ------------------------------------------------------------------ */

/** Every field any form can render. Drives labels and the error map. */
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

/**
 * Which fields each form marks with an asterisk.
 *
 * Derived by hand rather than from the schema: zod knows a field is required,
 * but "required" in the schema and "shows a star" in the UI are different
 * questions for optional-with-a-format fields, and a wrong star is a support
 * ticket. The tests in the route keep the two honest.
 */
export const REQUIRED: Record<EnquiryKind, EnquiryField[]> = {
  // profildesigntrading.dk/kontakt marks Navn, Telefon, E-mail, Emne, Besked.
  contact: ["name", "phone", "email", "subject", "message"],
  /*
   * Their callback strip marks nothing, so SEND can be pressed on an empty
   * form. Two are required here — a name and a number — because the entire
   * promise is that somebody rings you back.
   */
  callback: ["name", "phone"],
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

export type EnquiryResponse =
  | { ok: true }
  | { ok: false; errors: Partial<Record<EnquiryField, true>>; message?: string };

export function isEnquiryKind(value: unknown): value is EnquiryKind {
  return (
    typeof value === "string" && (ENQUIRY_KINDS as readonly string[]).includes(value)
  );
}

/**
 * Parse a raw payload into a validated enquiry.
 *
 * Returns the same `{ errors, enquiry }` shape the forms already consume, so the
 * components did not have to learn zod. `errors` is field → true because the UI
 * shows one generic message per field; zod's own messages are kept for the
 * server log, where the detail is worth having.
 */
export function validateEnquiry(raw: unknown): {
  errors: Partial<Record<EnquiryField, true>>;
  enquiry: Enquiry | null;
  issues: string[];
} {
  const result = enquirySchema.safeParse(raw);

  if (result.success) {
    return { errors: {}, enquiry: result.data, issues: [] };
  }

  const errors: Partial<Record<EnquiryField, true>> = {};
  const issues: string[] = [];

  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string") {
      errors[field as EnquiryField] = true;
    }
    issues.push(`${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }

  return { errors, enquiry: null, issues };
}
