/**
 * Who and where Profil Design Trading is.
 *
 * Ported from the live site's Kontakt page and footer. This is published
 * business contact data for the company this platform belongs to, so it lives
 * in the repo as content rather than being fetched from anywhere.
 *
 * Emails on the live site are obfuscated by Cloudflare, so each address here is
 * the one printed in plain text in the site footer. Camilla Berthelsen's is not
 * printed anywhere in plain text, so her entry carries no email — guessing one
 * from the pattern would put a possibly-wrong address in front of customers.
 */

export type Branch = {
  city: string;
  street: string;
  postcode: string;
};

export type Contact = {
  name: string;
  role: string;
  phone: string;
  email: string | null;
};

export const BRANCHES: Branch[] = [
  { city: "Vejle", street: "Bugattivej 9", postcode: "7100" },
  { city: "Fredericia", street: "Snaremosevej 23F", postcode: "7000" },
  { city: "Billund", street: "Montanavej 9", postcode: "7190" },
  { city: "Skjern", street: "Bredgade 13a", postcode: "6900" },
];

export const CONTACTS: Contact[] = [
  {
    name: "Allan Berthelsen",
    role: "Indehaver",
    phone: "+45 40 19 24 35",
    email: "Allan@profiltrading.dk",
  },
  {
    name: "Frederik Kjærulff Jensen",
    role: "Sales director / Co-owner",
    phone: "+45 40 19 34 04",
    email: "Fkj@profiltrading.dk",
  },
  {
    name: "Rikke Skougaard Ulriksen",
    role: "Salg / Backup",
    phone: "+45 22 56 79 80",
    email: "Rsu@profiltrading.dk",
  },
  {
    name: "Camilla Berthelsen",
    role: "Marketing",
    phone: "+45 22 54 00 68",
    email: null,
  },
];

/** The department a contact-form enquiry can be routed to. */
export const ENQUIRY_DEPARTMENTS = BRANCHES.map((b) => b.city);

export const COMPANY = {
  legalName: "Profil Design Trading ApS",
  cvr: "35657886",
  phone: "22 56 79 80",
  email: "info@profiltrading.dk",
  linkedIn: "https://dk.linkedin.com/company/profil-design-trading-aps",
  founded: 1994,
  founder: "Allan Berthelsen",
} as const;
