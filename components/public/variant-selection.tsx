"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * The chosen colour and size, shared between the picture and the chips.
 *
 * WHY A CONTEXT AND NOT PROPS. The gallery and the selector sit in different
 * columns of a two-column grid whose other half is server-rendered — the facts
 * table, the CO₂ row, the login notice. Lifting the state into a client
 * component that owns both halves would drag all of that across the client
 * boundary and ship it as serialised props, which is exactly the mistake that
 * once put the entire admin dictionary into every public page.
 *
 * A provider wrapping the grid keeps the server-rendered children server-
 * rendered: they pass through as `children` and are never re-serialised.
 */

type Selection = {
  colour: string | null;
  size: string | null;
  setColour: (value: string | null) => void;
  setSize: (value: string | null) => void;
  clear: () => void;
};

const VariantSelectionContext = createContext<Selection | null>(null);

export function VariantSelectionProvider({ children }: { children: ReactNode }) {
  const [colour, setColour] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);

  const value = useMemo<Selection>(
    () => ({
      colour,
      size,
      setColour,
      setSize,
      clear: () => {
        setColour(null);
        setSize(null);
      },
    }),
    [colour, size],
  );

  return (
    <VariantSelectionContext.Provider value={value}>
      {children}
    </VariantSelectionContext.Provider>
  );
}

export function useVariantSelection(): Selection {
  const value = useContext(VariantSelectionContext);
  if (!value) {
    throw new Error(
      "useVariantSelection must be used inside a VariantSelectionProvider",
    );
  }
  return value;
}
