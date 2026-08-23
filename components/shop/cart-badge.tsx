"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./cart-provider";

export function CartBadge({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const { count, ready } = useCart();

  return (
    <Link
      href={href}
      aria-label={label}
      className="relative inline-flex size-10 items-center justify-center rounded-md border border-border text-ink-700 transition-colors hover:bg-secondary"
    >
      <ShoppingBag className="size-5" />
      {/* Rendered only after hydration: the server has no way to know what is
          in localStorage, and guessing would mismatch. */}
      {ready && count > 0 ? (
        <span className="tabular absolute -top-1.5 -right-1.5 flex min-w-5 items-center justify-center rounded-full bg-highvis-500 px-1 text-[11px] font-bold text-ink-900">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
