"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  CART_STORAGE_KEY,
  cartCount,
  parseCart,
  type CartItem,
} from "@/lib/cart";

/*
 * The cart is an external store (localStorage), not React state, so it is read
 * with useSyncExternalStore rather than an effect that calls setState. That
 * gives a correct server snapshot for SSR, keeps other tabs in step, and avoids
 * the cascading render an effect-plus-setState would cause on every mount.
 */

const EMPTY: CartItem[] = [];

// getSnapshot must return a STABLE reference when nothing changed, or React
// re-renders forever. The raw string is the cache key.
let cachedRaw: string | null = null;
let cachedItems: CartItem[] = EMPTY;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Fires for writes made in OTHER tabs; same-tab writes call emit() directly.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): CartItem[] {
  const raw = window.localStorage.getItem(CART_STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedItems = parseCart(raw);
  }
  return cachedItems;
}

/** The server has no localStorage; an empty cart is the only honest answer. */
function getServerSnapshot(): CartItem[] {
  return EMPTY;
}

function write(next: CartItem[]) {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
  emit();
}

type CartContextValue = {
  items: CartItem[];
  count: number;
  /** False during SSR and the first client render, so the badge can stay hidden. */
  ready: boolean;
  add: (variantId: string, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const add = useCallback((variantId: string, qty = 1) => {
    const current = getSnapshot();
    const existing = current.find((i) => i.variantId === variantId);
    write(
      existing
        ? current.map((i) =>
            i.variantId === variantId
              ? { ...i, qty: Math.min(999, i.qty + qty) }
              : i,
          )
        : [...current, { variantId, qty }],
    );
  }, []);

  const setQty = useCallback((variantId: string, qty: number) => {
    const current = getSnapshot();
    write(
      qty <= 0
        ? current.filter((i) => i.variantId !== variantId)
        : current.map((i) =>
            i.variantId === variantId
              ? { ...i, qty: Math.min(999, Math.trunc(qty)) }
              : i,
          ),
    );
  }, []);

  const remove = useCallback((variantId: string) => {
    write(getSnapshot().filter((i) => i.variantId !== variantId));
  }, []);

  const clear = useCallback(() => write([]), []);

  const value = useMemo(
    () => ({
      items,
      count: cartCount(items),
      ready,
      add,
      setQty,
      remove,
      clear,
    }),
    [items, ready, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
