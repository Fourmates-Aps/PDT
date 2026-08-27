"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organisationMembers } from "@/lib/db/schema";
import { ROLES, isRole, type Role } from "@/lib/auth/roles";
import { AuthorizationError, requireRole } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteMember } from "@/lib/auth/invites";
import { recordAudit } from "@/lib/audit";
import {
  STAFF_ROLES,
  countActiveAdmins,
  getPlatformOrgId,
  getStaffMember,
} from "@/lib/db/queries/staff";
import { defaultLocale, hasLocale } from "@/lib/i18n/locales";

/**
 * Staff administration — PDT's own people.
 *
 * ADMIN ONLY, without exception. docs/PLATFORM-ADMIN.md: *"Only a platform admin
 * can create or change staff. Nobody else, ever."* Every action re-checks the
 * role, because a Server Action is a POST endpoint anyone can call and the page
 * that renders the form is not a gate.
 *
 * Two lockout protections are enforced here rather than only in the UI:
 *  - nobody may take away their own admin rights, and
 *  - the last active admin may not be deactivated,
 * because *"otherwise the system locks everyone out and only a server script can
 * rescue it."*
 */

export type StaffCode =
  | "invited"
  | "roleChanged"
  | "deactivated"
  | "reactivated"
  | "inviteResent"
  | "selfRoleChange"
  | "selfDeactivate"
  | "lastAdmin"
  | "notFound"
  | "noPlatformOrg"
  | "duplicate"
  | "invalidRole"
  | "invalidEmail"
  | "emailRejected"
  | "invalid"
  | "denied"
  | "generic";

export type ActionState =
  | { ok: boolean; code: StaffCode; values?: Record<string, string> }
  | null;

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError) return { ok: false, code: "denied" };
  const message = error instanceof Error ? error.message : "";
  if (/already been registered|already exists|duplicate key|unique/i.test(message)) {
    return { ok: false, code: "duplicate" };
  }
  return { ok: false, code: "generic" };
}

function str(formData: FormData, key: string): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  return raw ? raw : null;
}

function localeOf(formData: FormData): string {
  const value = formData.get("locale");
  return hasLocale(typeof value === "string" ? value : undefined)
    ? (value as string)
    : defaultLocale;
}

function revalidateStaff() {
  revalidatePath("/[lang]/dashboard/admin/staff", "page");
}

/** Human-readable role name for the audit sentence. */
const ROLE_LABEL: Record<Role, string> = {
  [ROLES.ADMIN]: "Administrator",
  [ROLES.KEY_ACCOUNT_MANAGER]: "Key Account Manager",
  [ROLES.WAREHOUSE]: "Lager",
  [ROLES.CUSTOMER_ADMIN]: "Kunde-admin",
  [ROLES.EMPLOYEE]: "Medarbejder",
};

/**
 * Invites a member of PDT's own staff.
 *
 * Reuses the same invite path as customer employees — which already writes the
 * role to `app_metadata` in a second call rather than to `user_metadata`, and
 * rolls the auth user back if that write fails. The only difference here is the
 * organisation: the platform row, never a customer's.
 */
export async function inviteStaffAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireRole([ROLES.ADMIN]);

    const email = str(formData, "email")?.toLowerCase() ?? null;
    const fullName = str(formData, "fullName");
    const roleValue = String(formData.get("role") ?? "");

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { ok: false, code: "invalidEmail" };
    }
    if (!isRole(roleValue) || !STAFF_ROLES.includes(roleValue)) {
      // Stops the Staff screen being used to mint a customer_admin or an
      // employee, which belong to a customer company and not to PDT.
      return { ok: false, code: "invalidRole" };
    }

    const platformOrgId = await getPlatformOrgId();
    if (!platformOrgId) return { ok: false, code: "noPlatformOrg" };

    const result = await inviteMember({
      email,
      role: roleValue,
      organisationId: platformOrgId,
      fullName,
      locale: localeOf(formData),
    });

    if (!result.ok) {
      if (result.reason === "duplicate") return { ok: false, code: "duplicate" };
      /*
       * Surfaced verbatim rather than flattened to "something went wrong".
       * inviteMember returns the provider's own message for exactly this case —
       * an SMTP outage, a rate limit, or a rejected address — and swallowing it
       * leaves an admin staring at a button that silently does nothing.
       */
      return {
        ok: false,
        code: "emailRejected",
        values: { reason: result.message },
      };
    }

    await recordAudit({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "staff.invited",
      entityType: "staff",
      summary: `${actor.email ?? "En administrator"} inviterede ${email} som ${ROLE_LABEL[roleValue]}.`,
      metadata: { email, role: roleValue },
    });

    revalidateStaff();
    return { ok: true, code: "invited", values: { email } };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Changes a staff member's role.
 *
 * Written in two places, because they answer two different questions:
 * `organisation_members.role` is what the dashboards read, and
 * `app_metadata.role` is what the JWT carries and every RLS policy authorises
 * against. Letting those drift is how someone keeps access they no longer have.
 */
export async function changeStaffRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireRole([ROLES.ADMIN]);

    const memberId = str(formData, "memberId");
    const roleValue = String(formData.get("role") ?? "");

    if (!memberId) return { ok: false, code: "invalid" };
    if (!isRole(roleValue) || !STAFF_ROLES.includes(roleValue)) {
      return { ok: false, code: "invalidRole" };
    }

    const member = await getStaffMember(memberId);
    if (!member) return { ok: false, code: "notFound" };
    if (member.role === roleValue) {
      return { ok: true, code: "roleChanged", values: { name: staffName(member) } };
    }

    // "You cannot remove your own admin rights."
    if (member.userId === actor.id) {
      return { ok: false, code: "selfRoleChange" };
    }

    // Demoting the last admin is the same lockout by another route.
    if (member.role === ROLES.ADMIN && roleValue !== ROLES.ADMIN) {
      const admins = await countActiveAdmins();
      if (admins <= 1) return { ok: false, code: "lastAdmin" };
    }

    const supabase = createAdminClient();
    const { data: authUser, error: readError } =
      await supabase.auth.admin.getUserById(member.userId);
    if (readError || !authUser?.user) return { ok: false, code: "notFound" };

    const { error: metaError } = await supabase.auth.admin.updateUserById(
      member.userId,
      {
        app_metadata: { ...authUser.user.app_metadata, role: roleValue },
      },
    );
    if (metaError) return { ok: false, code: "generic" };

    await db
      .update(organisationMembers)
      .set({ role: roleValue })
      .where(eq(organisationMembers.id, memberId));

    await recordAudit({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "staff.role_changed",
      entityType: "staff",
      entityId: memberId,
      summary: `${actor.email ?? "En administrator"} ændrede ${staffName(member)} fra ${ROLE_LABEL[member.role]} til ${ROLE_LABEL[roleValue]}.`,
      metadata: { from: member.role, to: roleValue, email: member.email },
    });

    revalidateStaff();
    return {
      ok: true,
      code: "roleChanged",
      values: { name: staffName(member), role: ROLE_LABEL[roleValue] },
    };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Deactivates or reactivates a staff member.
 *
 * "Access gone, their history intact" needs BOTH halves:
 *  - the membership row is flagged inactive, so the dashboards stop listing them
 *    as working here, and
 *  - the auth account is banned, so they cannot sign in.
 *
 * Flagging the row alone would not lock anyone out: authorisation reads the role
 * claim from the token, not the membership row, so a "deactivated" person would
 * keep working until their session expired.
 *
 * Nothing is deleted. The person's orders, decisions and audit lines stay
 * exactly where they were.
 *
 * KNOWN GAP: revoking an invite that was never accepted. That row is already
 * `is_active = false` — the invite flow's own "not yet accepted" state — so this
 * action treats it as a no-op and the Staff screen hides the control rather than
 * showing a button that does nothing. Cancelling an outstanding invite needs its
 * own action, because the only thing to undo is the auth account.
 */
export async function setStaffActiveAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireRole([ROLES.ADMIN]);

    const memberId = str(formData, "memberId");
    const active = formData.get("active") === "true";
    if (!memberId) return { ok: false, code: "invalid" };

    const member = await getStaffMember(memberId);
    if (!member) return { ok: false, code: "notFound" };
    if (member.isActive === active) {
      return {
        ok: true,
        code: active ? "reactivated" : "deactivated",
        values: { name: staffName(member) },
      };
    }

    if (!active) {
      // Deactivating yourself removes your own rights just as surely as a role
      // change does, so the same protection applies.
      if (member.userId === actor.id) {
        return { ok: false, code: "selfDeactivate" };
      }
      if (member.role === ROLES.ADMIN) {
        const admins = await countActiveAdmins();
        if (admins <= 1) return { ok: false, code: "lastAdmin" };
      }
    }

    const supabase = createAdminClient();
    const { error: banError } = await supabase.auth.admin.updateUserById(
      member.userId,
      // 100 years reads as permanent; "none" lifts it. Chosen over deleting the
      // account so the history keeps pointing at a real person.
      { ban_duration: active ? "none" : "876000h" },
    );
    if (banError) return { ok: false, code: "generic" };

    await db
      .update(organisationMembers)
      .set({ isActive: active })
      .where(eq(organisationMembers.id, memberId));

    await recordAudit({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: active ? "staff.reactivated" : "staff.deactivated",
      entityType: "staff",
      entityId: memberId,
      summary: active
        ? `${actor.email ?? "En administrator"} genaktiverede ${staffName(member)}.`
        : `${actor.email ?? "En administrator"} deaktiverede ${staffName(member)} — adgangen er spærret, historikken bevaret.`,
      metadata: { email: member.email, role: member.role },
    });

    revalidateStaff();
    return {
      ok: true,
      code: active ? "reactivated" : "deactivated",
      values: { name: staffName(member) },
    };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Re-sends an invitation that was never opened.
 *
 * Only offered to people who have never signed in — re-inviting someone with a
 * working account would send them a password-setting link they did not ask for,
 * which is indistinguishable from a phishing attempt.
 */
export async function resendStaffInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const actor = await requireRole([ROLES.ADMIN]);

    const memberId = str(formData, "memberId");
    if (!memberId) return { ok: false, code: "invalid" };

    const member = await getStaffMember(memberId);
    if (!member?.email) return { ok: false, code: "notFound" };
    if (member.lastSignInAt) return { ok: false, code: "invalid" };

    const locale = localeOf(formData);
    const supabase = createAdminClient();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const { error } = await supabase.auth.admin.inviteUserByEmail(
      member.email,
      { redirectTo: `${siteUrl}/${locale}/accept-invite` },
    );
    if (error) return { ok: false, code: "generic" };

    await recordAudit({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: "staff.invite_resent",
      entityType: "staff",
      entityId: memberId,
      summary: `${actor.email ?? "En administrator"} gensendte invitationen til ${member.email}.`,
      metadata: { email: member.email },
    });

    revalidateStaff();
    return {
      ok: true,
      code: "inviteResent",
      values: { email: member.email },
    };
  } catch (error) {
    return fail(error);
  }
}

function staffName(member: { fullName: string | null; email: string | null }) {
  return member.fullName ?? member.email ?? "medarbejderen";
}
