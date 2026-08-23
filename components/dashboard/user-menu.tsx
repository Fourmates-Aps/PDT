"use client";

import { LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-semibold text-ink-900">
            {email}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="size-3" />
            {roleLabel}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* A POST form, not a link: a GET sign-out can be triggered by any
            third-party page embedding the URL. */}
        <form action="/auth/signout" method="post">
          <input type="hidden" name="locale" value={locale} />
          <DropdownMenuItem
            render={<button type="submit" className="w-full" />}
            className="cursor-pointer"
          >
            <LogOut className="size-4" />
            {signOutLabel}
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
