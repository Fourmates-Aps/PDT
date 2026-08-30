import Image from "next/image";
import type { Dictionary, Locale } from "@/lib/i18n";
import { Section, Eyebrow } from "./section";
import { LeadForm } from "./lead-form";

export function Contact({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  return (
    <Section id="contact" tone="surface">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1fr] lg:gap-16">
        <div className="lg:pt-2">
          <Eyebrow>{dict.lead.eyebrow}</Eyebrow>
          <h2 className="mt-3 text-h2 font-display font-semibold text-balance text-ink-900">
            {dict.lead.title}
          </h2>
          <p className="mt-4 max-w-[40ch] text-lead text-ink-500">
            {dict.lead.body}
          </p>

          <dl className="mt-9 space-y-5 border-t border-bone-200 pt-8">
            <div>
              <dt className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                {dict.footer.phoneLabel}
              </dt>
              <dd className="mt-1">
                <a
                  href={`tel:+45${dict.footer.phone.replace(/\s/g, "")}`}
                  className="tabular text-lead font-semibold text-ink-900 hover:text-highvis-700"
                >
                  {dict.footer.phone}
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                {dict.footer.showroomsTitle}
              </dt>
              <dd className="mt-1 text-[15px] text-ink-800">
                {dict.footer.showrooms.join(" · ")}
              </dd>
            </div>
          </dl>

          {/* The client's own "har du brug for hjælp" photograph. Decorative:
              the person is not named, so an alt text would only be noise. */}
          <Image
            src="/images/photos/help.webp"
            alt=""
            width={645}
            height={325}
            aria-hidden="true"
            sizes="(min-width: 1024px) 380px, 90vw"
            className="mt-8 hidden h-auto w-full max-w-[380px] lg:block"
          />
        </div>

        <LeadForm dict={dict.lead} locale={locale} />
      </div>
    </Section>
  );
}
