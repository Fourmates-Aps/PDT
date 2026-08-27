import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { authUsers } from "drizzle-orm/supabase";
import { db } from "@/lib/db";
import { auditLog, organisationMembers, organisations } from "@/lib/db/schema";
import { ROLES, type Role } from "@/lib/auth/roles";

/**
 * PDT's own people.
 *
 * Staff are members of the PLATFORM organisation — the single row flagged
 * `is_platform`. That is what keeps them out of any customer's tenancy while
 * still giving every RLS policy a real organisation_id to read. See
 * lib/db/sql/30-platform-org.sql.
 */

/** The three roles that belong to PDT rather than to a customer. */
export const STAFF_ROLES: readonly Role[] = [
  ROLES.ADMIN,
  ROLES.KEY_ACCOUNT_MANAGER,
  ROLES.WAREHOUSE,
];

/**
 * The three states a staff account can be in.
 *
 * DERIVED FROM WHAT THE ACTIONS ACTUALLY WRITE, not from a single flag.
 *
 * `organisation_members.is_active` is overloaded: the invite flow creates the
 * row as INACTIVE and flips it to active on acceptance, so "never accepted" and
 * "revoked by an admin" share one false. Inferring the difference from whether
 * the person had ever signed in looked sufficient — until someone was revoked
 * BEFORE accepting, at which point the screen called a banned account "invited"
 * and offered to re-send its invitation.
 *
 * The ban is what deactivation really does (see setStaffActiveAction), so the
 * ban is what "deactivated" is read from. `auth.users.banned_until` is the
 * single fact behind it.
 */
export type StaffStatus = "invited" | "active" | "deactivated";

export function staffStatus(member: {
  isActive: boolean;
  bannedUntil: Date | null;
  lastSignInAt: Date | null;
}): StaffStatus {
  // A ban in the future is an admin decision, and it outranks everything else.
  if (member.bannedUntil && member.bannedUntil.getTime() > Date.now()) {
    return "deactivated";
  }
  if (member.isActive) return "active";
  // Not banned, not yet accepted: the invitation is still outstanding.
  return member.lastSignInAt === null ? "invited" : "deactivated";
}

export type StaffMember = {
  memberId: string;
  userId: string;
  email: string | null;
  fullName: string | null;
  role: Role;
  isActive: boolean;
  /** Null until they sign in for the first time — i.e. the invite is outstanding. */
  lastSignInAt: Date | null;
  /** Set by deactivation; the authoritative "access gone" fact. */
  bannedUntil: Date | null;
  status: StaffStatus;
  createdAt: Date;
};

/** A raw sql fragment comes back as a string; normalise it once. */
function asDate(value: Date | string | null): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The platform organisation's id, or null if bootstrap has not run. */
export async function getPlatformOrgId(): Promise<string | null> {
  const [row] = await db
    .select({ id: organisations.id })
    .from(organisations)
    .where(eq(organisations.isPlatform, true))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Everyone at PDT, active first, then by name.
 *
 * Email and last sign-in come from `auth.users` rather than being copied into
 * our own table: two records of the same fact drift, and the one people would
 * trust is the one that is wrong.
 */
export async function listStaff(): Promise<StaffMember[]> {
  const platformOrgId = await getPlatformOrgId();
  if (!platformOrgId) return [];

  const rows = await db
    .select({
      memberId: organisationMembers.id,
      userId: organisationMembers.userId,
      fullName: organisationMembers.fullName,
      role: organisationMembers.role,
      isActive: organisationMembers.isActive,
      createdAt: organisationMembers.createdAt,
      email: authUsers.email,
      lastSignInAt: authUsers.lastSignInAt,
      // Not in Drizzle's auth.users definition, so read directly.
      bannedUntil: sql<Date | null>`${authUsers}.banned_until`,
    })
    .from(organisationMembers)
    .leftJoin(authUsers, eq(organisationMembers.userId, authUsers.id))
    .where(
      and(
        eq(organisationMembers.organisationId, platformOrgId),
        inArray(organisationMembers.role, [...STAFF_ROLES]),
      ),
    )
    .orderBy(
      desc(organisationMembers.isActive),
      asc(organisationMembers.fullName),
    );

  return rows.map((r) => ({
    memberId: r.memberId,
    userId: r.userId,
    email: r.email,
    fullName: r.fullName,
    role: r.role as Role,
    isActive: r.isActive,
    lastSignInAt: r.lastSignInAt,
    bannedUntil: asDate(r.bannedUntil),
    status: staffStatus({ ...r, bannedUntil: asDate(r.bannedUntil) }),
    createdAt: r.createdAt,
  }));
}

/**
 * How many admins can still sign in.
 *
 * Drives the last-admin protection: the count is taken on the server at the
 * moment of the change, never from what the page happened to render.
 */
export async function countActiveAdmins(): Promise<number> {
  const platformOrgId = await getPlatformOrgId();
  if (!platformOrgId) return 0;

  const rows = await db
    .select({ id: organisationMembers.id })
    .from(organisationMembers)
    .where(
      and(
        eq(organisationMembers.organisationId, platformOrgId),
        eq(organisationMembers.role, ROLES.ADMIN),
        eq(organisationMembers.isActive, true),
      ),
    );

  return rows.length;
}

/** One staff member, with the platform-organisation check already applied. */
export async function getStaffMember(
  memberId: string,
): Promise<StaffMember | null> {
  const platformOrgId = await getPlatformOrgId();
  if (!platformOrgId) return null;

  const [row] = await db
    .select({
      memberId: organisationMembers.id,
      userId: organisationMembers.userId,
      fullName: organisationMembers.fullName,
      role: organisationMembers.role,
      isActive: organisationMembers.isActive,
      createdAt: organisationMembers.createdAt,
      email: authUsers.email,
      lastSignInAt: authUsers.lastSignInAt,
      bannedUntil: sql<Date | null>`${authUsers}.banned_until`,
    })
    .from(organisationMembers)
    .leftJoin(authUsers, eq(organisationMembers.userId, authUsers.id))
    .where(
      and(
        eq(organisationMembers.id, memberId),
        // Pins the lookup to PDT's own people: a member id belonging to a
        // customer's employee cannot be edited through the Staff screen.
        eq(organisationMembers.organisationId, platformOrgId),
      ),
    )
    .limit(1);

  if (!row) return null;

  return {
    memberId: row.memberId,
    userId: row.userId,
    email: row.email,
    fullName: row.fullName,
    role: row.role as Role,
    isActive: row.isActive,
    lastSignInAt: row.lastSignInAt,
    bannedUntil: asDate(row.bannedUntil),
    status: staffStatus({ ...row, bannedUntil: asDate(row.bannedUntil) }),
    createdAt: row.createdAt,
  };
}

export type AuditEntry = {
  id: string;
  actorEmail: string | null;
  action: string;
  summary: string;
  createdAt: Date;
};

/** Recent staff changes, newest first — the "who changed what" panel. */
export async function listStaffAudit(limit = 20): Promise<AuditEntry[]> {
  return db
    .select({
      id: auditLog.id,
      actorEmail: auditLog.actorEmail,
      action: auditLog.action,
      summary: auditLog.summary,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .where(eq(auditLog.entityType, "staff"))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}
