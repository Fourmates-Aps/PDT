import { pageMetadata } from "@/lib/page-metadata";
import { getDictionary, getLocale } from "@/lib/i18n";
import { PageHeader } from "@/components/dashboard/primitives";
import { CartView } from "@/components/shop/cart-view";

export function generateMetadata() {
  return pageMetadata((d) => d.shop.cart.title);
}

export default async function CartPage() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <>
      <PageHeader title={dict.shop.cart.title} lead={dict.shop.cart.lead} />
      <CartView dict={dict.shop} locale={locale} />
    </>
  );
}
