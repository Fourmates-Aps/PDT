/** Shared contract between the lead form and the lead route handler. */

export type LeadField = "company" | "name" | "email" | "employees";

export type LeadInput = {
  company: string;
  name: string;
  email: string;
  phone: string;
  employees: string;
  message: string;
  locale: string;
  /** Honeypot — must stay empty. Real users never see this field. */
  website?: string;
};

export type LeadResponse =
  | { ok: true }
  | { ok: false; errors: Partial<Record<LeadField, true>> };

const LIMITS = {
  company: 200,
  name: 200,
  email: 320,
  phone: 60,
  message: 4000,
} as const;

/**
 * Deliberately permissive: one @, a dot in the domain, no spaces. Stricter regexes
 * reject valid addresses, and the only real proof an address works is a reply to it.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateLead(raw: unknown): {
  errors: Partial<Record<LeadField, true>>;
  lead: LeadInput;
} {
  const body = (raw ?? {}) as Record<string, unknown>;

  const lead: LeadInput = {
    company: str(body.company).slice(0, LIMITS.company),
    name: str(body.name).slice(0, LIMITS.name),
    email: str(body.email).slice(0, LIMITS.email),
    phone: str(body.phone).slice(0, LIMITS.phone),
    employees: str(body.employees).slice(0, 10),
    message: str(body.message).slice(0, LIMITS.message),
    locale: str(body.locale) || "da",
    website: str(body.website),
  };

  const errors: Partial<Record<LeadField, true>> = {};

  if (!lead.company) errors.company = true;
  if (!lead.name) errors.name = true;
  if (!lead.email || !EMAIL.test(lead.email)) errors.email = true;

  const employees = Number(lead.employees);
  if (
    !lead.employees ||
    !Number.isFinite(employees) ||
    !Number.isInteger(employees) ||
    employees < 1 ||
    employees > 100000
  ) {
    errors.employees = true;
  }

  return { errors, lead };
}
