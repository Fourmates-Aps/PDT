"use server";

import { revalidatePath } from "next/cache";
import { ROLES, isRole } from "@/lib/auth/roles";
import {
  AuthorizationError,
  requireOrgAccess,
  requireRole,
} from "@/lib/auth/guards";
import {
  createOrganisation,
  inviteMember,
  revokeMember,
  INVITABLE_BY_CUSTOMER_ADMIN,
} from "@/lib/auth/invites";
import { hasLocale, defaultLocale } from "@/lib/i18n/locales";

/**
 * Server Actions for onboarding.
 *
 * Every one re-checks the caller's role. A Server Action is a POST endpoint that
 * anyone can invoke directly — the page that renders the form is not a gate.
 */

export type ActionState = { ok: boolean; message?: string } | null;

function localeOf(formData: FormData): string {
  const value = formData.get("locale");
  return hasLocale(typeof value === "string" ? value : undefined)
    ? (value as string)
    : defaultLocale;
}

function fail(error: unknown): ActionState {
  if (error instanceof AuthorizationError) {
    return { ok: false, message: "You are not allowed to do that." };
  }
  return {
    ok: false,
    message: error instanceof Error ? error.message : "Something went wrong.",
  };
}

/** Platform admin / KAM creates a customer organisation. */
export async function createOrganisationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRole([ROLES.ADMIN, ROLES.KEY_ACCOUNT_MANAGER]);

    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
    const cvr = String(formData.get("cvr") ?? "").trim();

    if (!name || !slug) {
      return { ok: false, message: "Name and slug are required." };
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return {
        ok: false,
        message: "Slug may contain only lowercase letters, numbers and hyphens.",
      };
    }

    const result = await createOrganisation({ name, slug, cvr });
    if (!result.ok) return { ok: false, message: result.message };

    revalidatePath(`/${localeOf(formData)}/dashboard/admin/orgs`);
    return { ok: true, message: `Created ${name}.` };
  } catch (error) {
    return fail(error);
  }
}

/** Platform admin / KAM invites the customer_admin for an organisation. */
export async function inviteOrgAdminAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireRole([ROLES.ADMIN, ROLES.KEY_ACCOUNT_MANAGER]);

    const email = String(formData.get("email") ?? "").trim();
    const organisationId = String(formData.get("organisationId") ?? "").trim();
    const fullName = String(formData.get("fullName") ?? "").trim();

    if (!email || !organisationId) {
      return { ok: false, message: "Email and organisation are required." };
    }

    const result = await inviteMember({
      email,
      role: ROLES.CUSTOMER_ADMIN,
      organisationId,
      fullName: fullName || null,
      locale: localeOf(formData),
    });

    if (!result.ok) return { ok: false, message: result.message };

    revalidatePath(`/${localeOf(formData)}/dashboard/admin/orgs`);
    return { ok: true, message: `Invite sent to ${result.email}.` };
  } catch (error) {
    return fail(error);
  }
}

/** Customer admin invites someone into their OWN organisation. */
export async function inviteEmployeeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const organisationId = String(formData.get("organisationId") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const fullName = String(formData.get("fullName") ?? "").trim();
    const roleValue = String(formData.get("role") ?? ROLES.EMPLOYEE);

    if (!email || !organisationId) {
      return { ok: false, message: "Email is required." };
    }

    // requireOrgAccess pins a customer_admin to their own organisation, so a
    // posted organisationId belonging to another company is refused.
    await requireOrgAccess(organisationId, [ROLES.CUSTOMER_ADMIN, ROLES.ADMIN]);

    if (!isRole(roleValue) || !INVITABLE_BY_CUSTOMER_ADMIN.includes(roleValue)) {
      // Stops a customer_admin minting a platform admin for themselves.
      return { ok: false, message: "That role cannot be invited here." };
    }

    const result = await inviteMember({
      email,
      role: roleValue,
      organisationId,
      fullName: fullName || null,
      locale: localeOf(formData),
    });

    if (!result.ok) return { ok: false, message: result.message };

    revalidatePath(`/${localeOf(formData)}/dashboard/customer/employees`);
    return { ok: true, message: `Invite sent to ${result.email}.` };
  } catch (error) {
    return fail(error);
  }
}

export async function revokeMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const organisationId = String(formData.get("organisationId") ?? "").trim();
    const memberId = String(formData.get("memberId") ?? "").trim();

    await requireOrgAccess(organisationId, [ROLES.CUSTOMER_ADMIN, ROLES.ADMIN]);

    if (!memberId) return { ok: false, message: "Missing member." };

    const result = await revokeMember({ memberId, organisationId });
    if (!result.ok) return { ok: false, message: result.message };

    revalidatePath(`/${localeOf(formData)}/dashboard/customer/employees`);
    return { ok: true, message: "Invite revoked." };
  } catch (error) {
    return fail(error);
  }
}
