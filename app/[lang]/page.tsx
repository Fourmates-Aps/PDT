import { getDictionary, getLocale } from "@/lib/i18n";
import { Header } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { TrustBar } from "@/components/landing/trust-bar";
import { Problem } from "@/components/landing/problem";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Suppliers } from "@/components/landing/suppliers";
import { Esg } from "@/components/landing/esg";
import { Contact } from "@/components/landing/contact";
import { Footer } from "@/components/landing/footer";

export default async function LandingPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <>
      <a
        href="#main"
        className="sr-only rounded-md bg-ink-900 px-4 py-2 text-bone-50 focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60]"
      >
        {dict.nav.skipToContent}
      </a>

      <Header dict={dict} locale={locale} />

      <main id="main">
        <Hero dict={dict} />
        <TrustBar dict={dict} />
        <Problem dict={dict} />
        <Features dict={dict} />
        <HowItWorks dict={dict} />
        <Suppliers dict={dict} />
        <Esg dict={dict} />
        <Contact dict={dict} locale={locale} />
      </main>

      <Footer dict={dict} locale={locale} />
    </>
  );
}
