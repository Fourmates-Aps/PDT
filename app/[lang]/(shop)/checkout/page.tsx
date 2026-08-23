import { pageMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { PageHeader } from "@/components/dashboard/primitives";
import { CheckoutView } from "@/components/shop/checkout-view";

export function generateMetadata() {
  return pageMetadata((d) => d.shop.checkout.title);
}

export default async function CheckoutPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <>
      <PageHeader
        title={dict.shop.checkout.title}
        lead={dict.shop.checkout.lead}
      />
      <CheckoutView dict={dict.shop} locale={locale} />
    </>
  );
}
