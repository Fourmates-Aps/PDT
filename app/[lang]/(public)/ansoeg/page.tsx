import { Info } from "lucide-react";
import { publicMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { Container } from "@/components/landing/section";
import { EnquiryForm, type FormField } from "@/components/public/enquiry-form";

export function generateMetadata() {
  return publicMetadata((d) => ({
    title: d.public.apply.title,
    description: d.public.apply.lead,
  }));
}

/**
 * Ansøg om B2B-login — the live site's /ansoeg-om-bruger.
 *
 * Field for field theirs, with one omission: they ask the applicant to choose a
 * password, and this does not. Q-A3a — does an applicant get an auth account
 * before a human approves them? — is open, and a password collected before that
 * is decided has nowhere to go. The note under the form says so in the visitor's
 * own terms.
 *
 * Their countries are Danmark, Schweiz and Tyskland; the same three are offered
 * here rather than a full country list, because those are the markets they say
 * they serve.
 */
const COUNTRIES = ["Danmark", "Schweiz", "Tyskland"];

const FIELDS: FormField[] = [
  { name: "company", wide: true },
  { name: "cvr" },
  { name: "ean" },
  { name: "firstName" },
  { name: "lastName" },
  { name: "address", wide: true },
  { name: "zipcode" },
  { name: "city" },
  { name: "country", type: "select", options: COUNTRIES },
  { name: "phone", type: "tel" },
  { name: "email", type: "email", wide: true },
];

export default async function ApplyPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.public.apply;

  return (
    <div className="py-10 md:py-14">
      <Container>
        <div className="max-w-[64ch]">
          <h1 className="text-h2 font-display font-semibold text-balance text-ink-900">
            {t.title}
          </h1>
          <p className="mt-3 text-lead text-ink-500">{t.lead}</p>

          <p className="mt-6 flex gap-3 rounded-md border border-border bg-bone-100/60 px-4 py-3 text-sm text-ink-700">
            <Info className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden="true" />
            {t.passwordNote}
          </p>

          <EnquiryForm
            kind="application"
            fields={FIELDS}
            dict={dict}
            locale={locale}
            submitLabel={t.submit}
            className="mt-6"
          />
        </div>
      </Container>
    </div>
  );
}
