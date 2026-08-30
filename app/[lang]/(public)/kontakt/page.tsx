import { Mail, MapPin, Phone } from "lucide-react";
import { publicMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { BRANCHES, CONTACTS, ENQUIRY_DEPARTMENTS } from "@/lib/content/company";
import { Container } from "@/components/landing/section";
import { EnquiryForm, type FormField } from "@/components/public/enquiry-form";

export function generateMetadata() {
  return publicMetadata((d) => ({
    title: d.public.contact.title,
    description: d.public.contact.lead,
  }));
}

/**
 * Kontakt — the live site's contact page.
 *
 * Same three parts in the same order: the four branches, the people, and a form
 * whose fields match theirs one for one (Firmanavn, Navn*, Adresse, Postnummer,
 * By, Land, Telefon*, E-mail*, Emne*, Afdeling, Besked*), down to which of them
 * are required.
 */
const FIELDS: FormField[] = [
  { name: "company" },
  { name: "name" },
  { name: "address", wide: true },
  { name: "zipcode" },
  { name: "city" },
  { name: "country" },
  { name: "phone", type: "tel" },
  { name: "email", type: "email" },
  { name: "subject" },
  { name: "department", type: "select", options: ENQUIRY_DEPARTMENTS },
  { name: "message", type: "textarea" },
];

export default async function ContactPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.public.contact;

  return (
    <div className="py-10 md:py-14">
      <Container>
        <header className="max-w-[54ch]">
          <h1 className="text-h2 font-display font-semibold text-balance text-ink-900">
            {t.title}
          </h1>
          <p className="mt-3 text-lead text-ink-500">{t.lead}</p>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[0.85fr_1fr] lg:gap-14">
          <div>
            <section>
              <h2 className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                {t.branchesTitle}
              </h2>
              <ul className="mt-4 space-y-4">
                {BRANCHES.map((branch) => (
                  <li key={branch.city} className="flex gap-3">
                    <MapPin
                      className="mt-0.5 size-4 shrink-0 text-ink-400"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-ink-800">
                      <span className="font-semibold text-ink-900">
                        {branch.city}
                      </span>
                      <br />
                      {branch.street}
                      <br />
                      <span className="tabular">
                        {branch.postcode} {branch.city}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-10">
              <h2 className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                {t.peopleTitle}
              </h2>
              <ul className="mt-4 divide-y divide-border border-y border-border">
                {CONTACTS.map((person) => (
                  <li key={person.name} className="py-4">
                    <p className="font-semibold text-ink-900">{person.name}</p>
                    <p className="text-sm text-ink-500">{person.role}</p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                      <a
                        href={`tel:${person.phone.replace(/\s/g, "")}`}
                        className="tabular inline-flex items-center gap-1.5 text-ink-800 hover:text-highvis-700"
                      >
                        <Phone className="size-3.5" aria-hidden="true" />
                        {person.phone}
                      </a>
                      {/*
                        * Camilla Berthelsen's address is nowhere in plain text on
                        * the live site — Cloudflare obfuscates it and the footer
                        * does not repeat it. Guessing from the pattern would put a
                        * possibly-wrong address in front of customers.
                        */}
                      {person.email ? (
                        <a
                          href={`mailto:${person.email}`}
                          className="inline-flex items-center gap-1.5 text-ink-800 hover:text-highvis-700"
                        >
                          <Mail className="size-3.5" aria-hidden="true" />
                          {person.email}
                        </a>
                      ) : (
                        <span className="text-ink-400">{t.noEmail}</span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section>
            <h2 className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">
              {t.formTitle}
            </h2>
            <EnquiryForm
              kind="contact"
              fields={FIELDS}
              dict={dict}
              locale={locale}
              submitLabel={t.submit}
              className="mt-4"
            />
          </section>
        </div>
      </Container>
    </div>
  );
}
