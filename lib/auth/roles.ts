/**
 * The five roles hardened from commit one. Mirrors the `member_role` enum in
 * lib/db/schema/enums.ts — if you add a role, change both.
 *
 * The authoritative copy of a user's role lives in Supabase Auth
 * `app_metadata`, because that is what lands in the JWT and therefore what RLS
 * policies can read. `app_metadata` is writable only with the service key, never
 * by the user, which is what makes it safe to authorise against — unlike
 * `user_metadata`, which the user can edit themselves.
 */
export const ROLES = {
  EMPLOYEE: "employee",
  CUSTOMER_ADMIN: "customer_admin",
  KEY_ACCOUNT_MANAGER: "key_account_manager",
  WAREHOUSE: "warehouse",
  ADMIN: "admin",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: readonly Role[] = Object.values(ROLES);

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ALL_ROLES.includes(value as Role);
}

export type AppMetadata = {
  role?: Role;
  organisation_id?: string;
};

/**
 * Route guards, keyed by the path AFTER the locale segment is stripped.
 * Longest match wins, so `/dashboard/admin` is checked before `/dashboard`.
 */
export const ROUTE_ROLES: Record<string, readonly Role[]> = {
  "/dashboard/admin": [ROLES.ADMIN],
  "/dashboard/warehouse": [ROLES.WAREHOUSE, ROLES.ADMIN],
  "/dashboard/kam": [ROLES.KEY_ACCOUNT_MANAGER, ROLES.ADMIN],
  "/dashboard/customer": [ROLES.CUSTOMER_ADMIN, ROLES.ADMIN],
  "/dashboard": ALL_ROLES,
  "/shop": [ROLES.EMPLOYEE, ROLES.CUSTOMER_ADMIN, ROLES.ADMIN],
};

/** Roles permitted on `path`, or null when the path is public. */
export function requiredRolesFor(path: string): readonly Role[] | null {
  const match = Object.keys(ROUTE_ROLES)
    .filter((route) => path === route || path.startsWith(`${route}/`))
    .sort((a, b) => b.length - a.length)[0];

  return match ? ROUTE_ROLES[match] : null;
}
