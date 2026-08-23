"use client";

import { LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  email,
  roleLabel,
  accountLabel,
  signOutLabel,
  locale,
}: {
  email: string;
  roleLabel: string;
  accountLabel: string;
  signOutLabel: string;
  locale: string;
}) {
  const initials = (email[0] ?? "?").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={accountLabel}
        className="inline-flex size-10 items-center justify-center rounded-full bg-ink-900 font-display text-sm font-bold text-bone-50 transition-opacity hover:opacity-90"
      >
        {initials}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        {/* Group wrapper is required: DropdownMenuLabel maps to Base UI's
            Menu.GroupLabel, which throws without a Menu.Group parent. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-sm font-semibold text-ink-900">
              {email}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="size-3" />
              {roleLabel}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/*
          A plain form + button, NOT DropdownMenuItem.

          Base UI's menu item refuses a <button> in its `render` prop, and
          signing out is the one control a user must always be able to reach —
          so it does not depend on the menu item's internals. Styled to match
          the other rows.

          POST, never a link: a GET sign-out can be triggered by any third-party
          page embedding the URL.
        */}
        <form action="/auth/signout" method="post" className="p-1">
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-ink-800 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent"
          >
            <LogOut className="size-4" />
            {signOutLabel}
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
