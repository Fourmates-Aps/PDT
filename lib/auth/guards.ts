import "server-only";
import { getSessionUser, type SessionUser } from "@/lib/supabase/server";
import { ROLES, type Role } from "./roles";

/**
 * Server-side authorisation for Server Components and Server Actions.
 *
 * proxy.ts redirects unauthorised page loads, but that is navigation convenience,
 * not a boundary: a Server Action is a POST to an endpoint and is reachable
 * without ever passing through a guarded page render. Every mutating action must
 * call one of these itself.
 */

export class AuthorizationError extends Error {
  constructor(message = "Not authorised") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** The signed-in user, or throws. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthorizationError("Not signed in");
  return user;
}

/** The signed-in user, or throws unless they hold one of `roles`. */
export async function requireRole(
  roles: readonly Role[],
): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.role || !roles.includes(user.role)) {
    throw new AuthorizationError("Insufficient role");
  }
  return user;
}

/**
 * A user acting inside a specific organisation.
 *
 * Platform admins may act on any organisation. Everyone else is pinned to the
 * organisation in their own token — so a customer_admin cannot invite people into
 * someone else's company by posting a different organisationId.
 */
export async function requireOrgAccess(
  organisationId: string,
  roles: readonly Role[],
): Promise<SessionUser> {
  const user = await requireRole(roles);

  if (user.role === ROLES.ADMIN) return user;

  if (!user.organisationId || user.organisationId !== organisationId) {
    throw new AuthorizationError("Organisation mismatch");
  }

  return user;
}
