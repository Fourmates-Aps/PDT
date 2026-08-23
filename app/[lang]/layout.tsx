import type { Metadata } from "next";
import { Familjen_Grotesk, Instrument_Sans } from "next/font/google";
import { lang } from "next/root-params";
import { notFound } from "next/navigation";
import "../globals.css";
import { defaultLocale, hasLocale, locales, dictionaryFor } from "@/lib/i18n";

/*
 * This is the application's root layout. It sits under the `[lang]` dynamic segment,
 * which makes `lang` a *root parameter*: any Server Component can read it through
 * `next/root-params` without it being passed down as a prop.
 */

const familjen = Familjen_Grotesk({
  subsets: ["latin"],
  variable: "--font-familjen",
  display: "swap",
});

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://profildesigntrading.dk";

export function generateStaticParams() {
  return locales.map((locale) => ({ lang: locale }));
}

/** Only `da` and `en` exist; anything else is a 404 rather than an on-demand render. */
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang: locale } = await params;
  const dict = dictionaryFor(locale);
  const path = `/${hasLocale(locale) ? locale : defaultLocale}`;

  return {
    metadataBase: new URL(siteUrl),
    title: dict.meta.title,
    description: dict.meta.description,
    alternates: {
      canonical: path,
      languages: {
        da: "/da",
        en: "/en",
        "x-default": `/${defaultLocale}`,
      },
    },
    openGraph: {
      type: "website",
      siteName: "Profil Design Trading",
      title: dict.meta.title,
      description: dict.meta.description,
      url: path,
      locale: locale === "en" ? "en_GB" : "da_DK",
    },
    twitter: {
      card: "summary_large_image",
      title: dict.meta.title,
      description: dict.meta.description,
    },
  };
}

export default async function RootLayout(props: LayoutProps<"/[lang]">) {
  const locale = await lang();
  if (!hasLocale(locale)) notFound();

  return (
    // No height constraint on <html>: pinning it to 100% while the body overflows
    // breaks in-page anchor scrolling (the browser resolves anchor offsets against
    // the capped html box).
    // `data-scroll-behavior="smooth"` is required by Next 16 whenever the document
    // sets `scroll-behavior: smooth`; without it the router logs a warning and
    // route transitions animate their scroll instead of jumping.
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`${familjen.variable} ${instrument.variable}`}
    >
      <body className="min-h-screen">{props.children}</body>
    </html>
  );
}
