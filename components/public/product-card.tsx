import Link from "next/link";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { PublicProduct } from "@/lib/db/queries/public-catalogue";
import { ProductImage } from "@/components/shop/product-image";
import { productHref } from "@/lib/public-routes";

/**
 * A product as a stranger sees it.
 *
 * NO PRICE — and the gap is filled with the reason rather than left blank. The
 * live site shows the same card with an empty Pris column, which reads as missing
 * data; saying "log ind for priser" says the price exists and belongs to an
 * agreement. See lib/db/queries/public-catalogue.ts for why it cannot be shown.
 *
 * `Varenr.` is the supplier SKU, which is what the live site prints and what a
 * customer quotes back over the phone.
 */
export function PublicProductCard({
  product,
  dict,
  locale,
}: {
  product: PublicProduct;
  dict: Dictionary;
  locale: Locale;
}) {
  const t = dict.public.card;

  return (
    <Link
      href={productHref(locale, product.slug)}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-ink-300"
    >
      <div className="aspect-square overflow-hidden bg-bone-100">
        <ProductImage
          src={product.image}
          alt={product.name}
          className="size-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-highvis-700">
          {product.brand}
        </p>
        <h3 className="mt-1.5 text-sm font-semibold text-balance text-ink-900">
          {product.name}
        </h3>
        <p className="tabular mt-1 text-xs text-ink-500">
          {t.sku}: {product.supplierSku}
        </p>
        <p className="mt-auto pt-3 text-xs font-semibold text-ink-400">
          {t.pricesHidden}
        </p>
      </div>
    </Link>
  );
}
