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
  cartCount,
  cartLineKey,
  cartStorageKey,
  parseCart,
  type CartItem,
} from "@/lib/cart";
import type { CartLogo } from "@/lib/shop/logo";

/*
 * The cart is an external store (localStorage), not React state, so it is read
 * with useSyncExternalStore rather than an effect that calls setState. That
 * gives a correct server snapshot for SSR, keeps other tabs in step, and avoids
 * the cascading render an effect-plus-setState would cause on every mount.
 */

const EMPTY: CartItem[] = [];

/*
 * One store per storage key, so two providers for different users never share a
 * snapshot cache. In practice there is one per page, but keying the cache makes
 * the wrong answer impossible rather than merely unlikely.
 *
 * getSnapshot must return a STABLE reference when nothing changed, or React
 * re-renders forever. The raw string is the cache key.
 */
type Store = {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => CartItem[];
  read: () => CartItem[];
  write: (next: CartItem[]) => void;
};

const stores = new Map<string, Store>();

function storeFor(key: string): Store {
  const existing = stores.get(key);
  if (existing) return existing;

  const listeners = new Set<() => void>();
  let cachedRaw: string | null = null;
  let cachedItems: CartItem[] = EMPTY;

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const read = () => {
    const raw = window.localStorage.getItem(key);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedItems = parseCart(raw);
    }
    return cachedItems;
  };

  const store: Store = {
    subscribe(onChange) {
      listeners.add(onChange);
      // Fires for writes made in OTHER tabs; same-tab writes call emit().
      window.addEventListener("storage", onChange);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    getSnapshot: read,
    read,
    write(next) {
      window.localStorage.setItem(key, JSON.stringify(next));
      emit();
    },
  };

  stores.set(key, store);
  return store;
}

/** The server has no localStorage; an empty cart is the only honest answer. */
function getServerSnapshot(): CartItem[] {
  return EMPTY;
}

type CartContextValue = {
  items: CartItem[];
  count: number;
  /** False during SSR and the first client render, so the badge can stay hidden. */
  ready: boolean;
  /**
   * Adds a line. Lines are keyed by variant AND logo choice, so the same garment
   * with two different logo placements stacks as two lines rather than merging.
   */
  add: (variantId: string, qty?: number, logos?: CartLogo[]) => void;
  setQty: (lineKey: string, qty: number) => void;
  remove: (lineKey: string) => void;
  /** Drops every line for a variant, whatever logo choice it carries. */
  removeVariant: (variantId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  scope,
  children,
}: {
  /** Signed-in user id: the cart is per person, not per browser. */
  scope: string;
  children: ReactNode;
}) {
  const store = useMemo(() => storeFor(cartStorageKey(scope)), [scope]);
  const { subscribe, getSnapshot, read, write } = store;

  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const add = useCallback(
    (variantId: string, qty = 1, logos?: CartLogo[]) => {
      const current = read();
      const key = cartLineKey({ variantId, logos });
      const existing = current.find((i) => cartLineKey(i) === key);
      write(
        existing
          ? current.map((i) =>
              cartLineKey(i) === key
                ? { ...i, qty: Math.min(999, i.qty + qty) }
                : i,
            )
          : [...current, { variantId, qty, logos }],
      );
    },
    [read, write],
  );

  const setQty = useCallback((lineKey: string, qty: number) => {
    const current = read();
    write(
      qty <= 0
        ? current.filter((i) => cartLineKey(i) !== lineKey)
        : current.map((i) =>
            cartLineKey(i) === lineKey
              ? { ...i, qty: Math.min(999, Math.trunc(qty)) }
              : i,
          ),
    );
  }, [read, write]);

  const remove = useCallback(
    (lineKey: string) => {
      write(read().filter((i) => cartLineKey(i) !== lineKey));
    },
    [read, write],
  );

  const removeVariant = useCallback(
    (variantId: string) => {
      write(read().filter((i) => i.variantId !== variantId));
    },
    [read, write],
  );

  const clear = useCallback(() => write([]), [write]);

  const value = useMemo(
    () => ({
      items,
      count: cartCount(items),
      ready,
      add,
      setQty,
      remove,
      removeVariant,
      clear,
    }),
    [items, ready, add, setQty, remove, removeVariant, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
