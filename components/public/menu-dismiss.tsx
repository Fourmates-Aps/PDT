"use client";

import { useEffect } from "react";

/**
 * Escape and click-outside for the header menus.
 *
 * Purely an enhancement. The menus are <details> elements that already open,
 * close and — because they share a `name` — stay mutually exclusive without any
 * script at all. What plain <details> does NOT do is close when you press
 * Escape or click somewhere else on the page, so a menu you have finished with
 * sits there over the content until you click its summary again.
 *
 * Renders nothing. If this never loads, the header still works.
 */
export function MenuDismiss({ name }: { name: string }) {
  useEffect(() => {
    const open = () =>
      Array.from(
        document.querySelectorAll<HTMLDetailsElement>(
          `details[name="${name}"][open]`,
        ),
      );

    const closeAll = () => {
      for (const details of open()) details.open = false;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const menus = open();
      if (menus.length === 0) return;
      // Focus is likely inside the panel that is about to vanish; put it back on
      // the control that opened it, or the next Tab starts from the top of the
      // document.
      const summary = menus[0].querySelector("summary");
      closeAll();
      summary?.focus();
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      // A click inside a menu is either a link (which navigates) or the summary
      // (which toggles). Neither is our business.
      if (open().some((details) => details.contains(target))) return;
      closeAll();
    };

    document.addEventListener("keydown", onKeyDown);
    // Capture, so a menu still closes when the click lands on something that
    // stops propagation on its way up.
    document.addEventListener("pointerdown", onPointerDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [name]);

  return null;
}
