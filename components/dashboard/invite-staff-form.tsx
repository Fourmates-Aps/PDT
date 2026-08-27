"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";
import { inviteStaffAction } from "@/app/[lang]/dashboard/admin/staff-actions";
import { StaffMessage } from "./staff-message";
import type { Dictionary } from "@/lib/i18n";

type Dict = Dictionary["admin"]["staff"];
type StaffRole = "admin" | "key_account_manager" | "warehouse";

const STAFF_ROLES: StaffRole[] = ["key_account_manager", "warehouse", "admin"];

/**
 * Invite a member of PDT's own staff.
 *
 * The role picker carries a one-line description of what each role can see,
 * because the person filling this in is granting access to a live system and
 * "KAM" alone does not say whether that includes the finance screens.
 *
 * Only the three PDT roles are offered. Customer admins and employees belong to
 * a customer company and are invited from that company's own screens.
 */
export function InviteStaffForm({
  dict,
  locale,
}: {
  dict: Dict;
  locale: "da" | "en";
}) {
  const [state, formAction, pending] = useActionState(inviteStaffAction, null);
  const [role, setRole] = useState<StaffRole>("key_account_manager");

  return (
    <form action={formAction}>
      <input type="hidden" name="locale" value={locale} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
            {dict.email}
          </span>
          <input
            name="email"
            type="email"
            required
            autoComplete="off"
            placeholder="navn@profildesigntrading.dk"
            className="mt-2 w-full rounded-sm border border-bone-300 bg-white px-3.5 py-2.5 text-[15px] text-ink-800 transition-colors placeholder:text-ink-300 hover:border-ink-300 focus:border-ink-900 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
            {dict.fullName}
          </span>
          <input
            name="fullName"
            autoComplete="off"
            className="mt-2 w-full rounded-sm border border-bone-300 bg-white px-3.5 py-2.5 text-[15px] text-ink-800 transition-colors hover:border-ink-300 focus:border-ink-900 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">
            {dict.role}
          </span>
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as StaffRole)}
            className="mt-2 w-full rounded-sm border border-bone-300 bg-white px-3.5 py-2.5 text-[15px] text-ink-800 transition-colors hover:border-ink-300 focus:border-ink-900 focus:outline-none"
          >
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {dict.roles[r]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* What this grant actually means, in one line. */}
      <p aria-live="polite" className="mt-3 text-sm text-ink-500">
        {dict.roleHints[role]}
      </p>

      <button
        type="submit"
        disabled={pending}
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-ink-900 px-5 py-2.5 text-sm font-semibold text-bone-50 transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <UserPlus className="size-4" />
        {pending ? dict.inviting : dict.invite}
      </button>

      <StaffMessage state={state} messages={dict.messages} className="mt-3 text-sm" />
    </form>
  );
}
