"use client";

import { useActionState } from "react";
import { Check, Shield } from "lucide-react";
import {
  changeStaffRoleAction,
  resendStaffInviteAction,
  setStaffActiveAction,
} from "@/app/[lang]/dashboard/admin/staff-actions";
import { StaffMessage } from "./staff-message";
import type { Role } from "@/lib/auth/roles";
import type { Dictionary } from "@/lib/i18n";

type Dict = Dictionary["admin"]["staff"];
type StaffRole = "admin" | "key_account_manager" | "warehouse";

export type StaffRowData = {
  memberId: string;
  email: string | null;
  fullName: string | null;
  role: Role;
  isActive: boolean;
  status: "invited" | "active" | "deactivated";
  /** Rendered server-side so the row does not have to know the locale. */
  lastSignInLabel: string;
  isSelf: boolean;
  /** True when removing this person would leave PDT with no admin. */
  isLastAdmin: boolean;
};

/**
 * One person at PDT.
 *
 * The two protections — you cannot change your own access, and the last
 * administrator cannot be removed — are shown here as disabled controls with the
 * reason spelled out, and enforced again on the server. The UI copy exists so nobody
 * clicks a button that was always going to be refused; the server version is
 * what actually holds.
 */
export function StaffRow({
  staff,
  dict,
  locale,
}: {
  staff: StaffRowData;
  dict: Dict;
  locale: "da" | "en";
}) {
  const [roleState, roleAction, rolePending] = useActionState(
    changeStaffRoleAction,
    null,
  );
  const [activeState, activeAction, activePending] = useActionState(
    setStaffActiveAction,
    null,
  );
  const [resendState, resendAction, resendPending] = useActionState(
    resendStaffInviteAction,
    null,
  );

  // Locked when acting on yourself, or when this is the last way back in.
  const locked = staff.isSelf || (staff.isLastAdmin && staff.isActive);
  const lockReason = staff.isSelf
    ? dict.protectedSelf
    : dict.protectedLastAdmin;

  const hasMessage = roleState || activeState || resendState;

  return (
    // Grid rather than a flex row: the result line has to span the full width
    // underneath, and a full-width flex child in a non-wrapping row squeezes
    // every sibling into its minimum size instead.
    <li className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_10rem_16rem_auto] lg:items-center lg:gap-4">
      {/* Person */}
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-ink-900">
          <span className="truncate">{staff.fullName ?? staff.email ?? "—"}</span>
          {staff.isSelf ? (
            <span className="rounded-sm bg-highvis-50 px-1.5 py-0.5 text-[10px] font-semibold text-highvis-700">
              {dict.you}
            </span>
          ) : null}
          {staff.role === "admin" ? (
            <Shield className="size-3.5 shrink-0 text-ink-400" aria-hidden="true" />
          ) : null}
        </p>
        <p className="truncate text-sm text-ink-500">{staff.email ?? "—"}</p>
      </div>

      {/* Status */}
      <div className="min-w-0">
        <span
          className={`inline-block rounded-sm px-2 py-0.5 text-[11px] font-semibold ${
            staff.status === "active"
              ? "bg-success/10 text-success"
              : staff.status === "invited"
                ? "bg-warning/15 text-warning"
                : "bg-bone-200 text-ink-500"
          }`}
        >
          {staff.status === "active"
            ? dict.statusActive
            : staff.status === "invited"
              ? dict.statusInvited
              : dict.statusInactive}
        </span>
        <p className="tabular mt-1 text-xs text-ink-500">
          {dict.colLastSignIn}: {staff.lastSignInLabel}
        </p>
      </div>

      {/* Role */}
      <form action={roleAction} className="flex min-w-0 items-center gap-2">
        <input type="hidden" name="memberId" value={staff.memberId} />
        <label className="sr-only" htmlFor={`role-${staff.memberId}`}>
          {dict.role}
        </label>
        <select
          id={`role-${staff.memberId}`}
          name="role"
          defaultValue={staff.role}
          disabled={locked || rolePending}
          title={locked ? lockReason : undefined}
          className="min-w-0 flex-1 rounded-sm border border-bone-300 bg-white px-2.5 py-1.5 text-sm text-ink-800 transition-colors hover:border-ink-300 focus:border-ink-900 focus:outline-none disabled:cursor-not-allowed disabled:bg-bone-100 disabled:text-ink-400"
        >
          {(["admin", "key_account_manager", "warehouse"] as StaffRole[]).map(
            (r) => (
              <option key={r} value={r}>
                {dict.roles[r]}
              </option>
            ),
          )}
        </select>
        <button
          type="submit"
          disabled={locked || rolePending}
          className="shrink-0 rounded-sm border border-bone-300 px-2.5 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:border-ink-900 hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {rolePending ? dict.changingRole : dict.changeRole}
        </button>
        {roleState?.ok ? (
          <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
        ) : null}
      </form>

      {/* Access */}
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        {staff.status === "invited" ? (
          <form action={resendAction}>
            <input type="hidden" name="memberId" value={staff.memberId} />
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              disabled={resendPending}
              className="rounded-sm border border-bone-300 px-2.5 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:border-ink-900 hover:text-ink-900 disabled:opacity-50"
            >
              {resendPending ? dict.resending : dict.resend}
            </button>
          </form>
        ) : null}

        {/*
          * Deliberately absent while an invite is outstanding.
          *
          * The membership row is already inactive in that state, so a
          * "reactivate" button would claim to grant access the person has not
          * accepted yet, and "deactivate" would be a no-op. Revoking an
          * unaccepted invite is a real action, but it is not modelled — see the
          * note in staff-actions.ts.
          */}
        {staff.status === "invited" ? null : (
        <form action={activeAction}>
          <input type="hidden" name="memberId" value={staff.memberId} />
          <input
            type="hidden"
            name="active"
            value={staff.isActive ? "false" : "true"}
          />
          <button
            type="submit"
            disabled={locked || activePending}
            title={locked ? lockReason : undefined}
            className={`rounded-sm border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              staff.isActive
                ? "border-bone-300 text-ink-700 hover:border-error hover:text-error"
                : "border-ink-900 text-ink-900 hover:bg-ink-900 hover:text-bone-50"
            }`}
          >
            {activePending
              ? dict.updating
              : staff.isActive
                ? dict.deactivate
                : dict.reactivate}
          </button>
        </form>
        )}
      </div>

      {/* Results — whichever form produced one, on its own full-width row. */}
      {hasMessage ? (
        <div className="lg:col-span-full">
          <StaffMessage state={roleState} messages={dict.messages} className="text-sm" />
          <StaffMessage state={activeState} messages={dict.messages} className="text-sm" />
          <StaffMessage state={resendState} messages={dict.messages} className="text-sm" />
        </div>
      ) : null}
    </li>
  );
}
