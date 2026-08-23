import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organisationMembers, organisations } from "@/lib/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLES, type Role } from "./roles";

export type InviteResult =
  | { ok: true; email: string }
  | { ok: false; reason: "duplicate" | "email" | "unknown"; message: string };

const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Invites someone into an organisation with a role.
 *
 * WHY THE ROLE IS SET IN A SECOND CALL
 *
 * DEV_BRIEF_IMPLEMENTATION_PLAN.md §4.3 passes the role through
 * `inviteUserByEmail(email, { data: { role, organisation_id } })`. That is a
 * privilege-escalation bug: `data` is written to `user_metadata`, which the user
 * can rewrite at will with `auth.updateUser()`. Every RLS policy in this project
 * authorises on those two claims, so an invited employee could promote themselves
 * to `admin` and read every tenant.
 *
 * `inviteUserByEmail` has no `app_metadata` parameter, so the role is written
 * afterwards with `updateUserById`. `app_metadata` is writable only with the
 * secret key and is therefore safe to authorise against.
 *
 * If that second call fails we delete the invited auth user, because a user who
 * can sign in with no role and no organisation is a worse outcome than a failed
 * invite.
 */
export async function inviteMember(params: {
  email: string;
  role: Role;
  organisationId: string;
  fullName?: string | null;
  departmentId?: string | null;
  locale: string;
}): Promise<InviteResult> {
  const admin = createAdminClient();
  const email = params.email.trim().toLowerCase();

  /*
   * Point straight at the accept-invite PAGE, not the /auth/callback route.
   *
   * Supabase verifies the emailed link on its own /auth/v1/verify endpoint and
   * then 303s here with the session in the URL *hash*:
   *   /da/accept-invite#access_token=…&refresh_token=…&type=invite
   *
   * A hash fragment is never sent to the server, so a Route Handler physically
   * cannot read it — the old /auth/callback target saw no `code`, found nothing
   * to exchange, and redirected every invitee to the login page. The page below
   * picks the tokens up on the client instead.
   */
  const redirectTo = `${siteUrl()}/${params.locale}/accept-invite`;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  if (error || !data?.user) {
    const message = error?.message ?? "Invite failed";
    // Surfaced verbatim rather than swallowed: without SMTP configured in the
    // Supabase project this is where it fails, and a silent "success" would
    // leave the admin waiting for an email that was never sent.
    if (/already been registered|already exists/i.test(message)) {
      return { ok: false, reason: "duplicate", message };
    }
    return { ok: false, reason: "email", message };
  }

  const userId = data.user.id;

  const { error: metaError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      role: params.role,
      organisation_id: params.organisationId,
    },
  });

  if (metaError) {
    // Roll back: better no user than a user who can sign in unauthorised.
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return {
      ok: false,
      reason: "unknown",
      message: `Could not assign role, invite cancelled: ${metaError.message}`,
    };
  }

  try {
    await db.insert(organisationMembers).values({
      organisationId: params.organisationId,
      userId,
      role: params.role,
      fullName: params.fullName ?? null,
      departmentId: params.departmentId ?? null,
      // Flipped to true when they accept and set a password, so the admin can
      // see who is still outstanding.
      isActive: false,
    });
  } catch (dbError) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    const message =
      dbError instanceof Error ? dbError.message : "Database error";
    if (/duplicate key|unique/i.test(message)) {
      return {
        ok: false,
        reason: "duplicate",
        message: "That person is already a member of this organisation.",
      };
    }
    return { ok: false, reason: "unknown", message };
  }

  return { ok: true, email };
}

/** Cancels a pending invite: removes the membership and the auth user. */
export async function revokeMember(params: {
  memberId: string;
  organisationId: string;
}): Promise<{ ok: boolean; message?: string }> {
  const rows = await db
    .select({
      id: organisationMembers.id,
      userId: organisationMembers.userId,
      organisationId: organisationMembers.organisationId,
    })
    .from(organisationMembers)
    .where(eq(organisationMembers.id, params.memberId))
    .limit(1);

  const member = rows[0];
  if (!member) return { ok: false, message: "Member not found" };

  // Defence in depth: the caller was already checked, but this stops a crafted
  // memberId from another organisation being deleted through this action.
  if (member.organisationId !== params.organisationId) {
    return { ok: false, message: "Organisation mismatch" };
  }

  const admin = createAdminClient();
  await db
    .delete(organisationMembers)
    .where(eq(organisationMembers.id, member.id));
  await admin.auth.admin.deleteUser(member.userId).catch(() => {});

  return { ok: true };
}

/** Activates the caller's own membership once they have set a password. */
export async function activateOwnMembership(userId: string): Promise<void> {
  await db
    .update(organisationMembers)
    .set({ isActive: true })
    .where(eq(organisationMembers.userId, userId));
}

export async function createOrganisation(params: {
  name: string;
  slug: string;
  cvr?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const [row] = await db
      .insert(organisations)
      .values({
        name: params.name.trim(),
        slug: params.slug.trim().toLowerCase(),
        cvr: params.cvr?.trim() || null,
      })
      .returning({ id: organisations.id });

    return { ok: true, id: row.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database error";
    if (/duplicate key|unique/i.test(message)) {
      return { ok: false, message: "That slug is already taken." };
    }
    return { ok: false, message };
  }
}

export const INVITABLE_BY_CUSTOMER_ADMIN: readonly Role[] = [
  ROLES.EMPLOYEE,
  ROLES.CUSTOMER_ADMIN,
];
