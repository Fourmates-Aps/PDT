import "server-only";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  approvalRequests,
  departments,
  employeeQuotas,
  organisationMembers,
  organisations,
  orders,
} from "@/lib/db/schema";

/**
 * Queries for the kunde-admin dashboard.
 *
 * Every one is scoped by organisationId explicitly. Drizzle connects as the
 * database owner and therefore BYPASSES Row-Level Security, so the scoping here
 * is the boundary, not a convenience — see lib/db/index.ts.
 */

export async function getOrganisation(organisationId: string) {
  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, organisationId))
    .limit(1);
  return org ?? null;
}

export async function getOverview(organisationId: string) {
  const startOfYear = new Date(new Date().getFullYear(), 0, 1);

  const [[members], [pending], [spend]] = await Promise.all([
    db
      .select({ value: count() })
      .from(organisationMembers)
      .where(
        and(
          eq(organisationMembers.organisationId, organisationId),
          eq(organisationMembers.isActive, true),
        ),
      ),
    db
      .select({ value: count() })
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.organisationId, organisationId),
          eq(approvalRequests.status, "pending"),
        ),
      ),
    db
      .select({
        value: sql<string>`coalesce(sum(${orders.totalDkk}), 0)`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.organisationId, organisationId),
          gte(orders.createdAt, startOfYear),
        ),
      ),
  ]);

  return {
    memberCount: members?.value ?? 0,
    pendingApprovals: pending?.value ?? 0,
    spendYtd: spend?.value ?? "0",
  };
}

/** Employees whose remaining allowance has dropped below 45%. */
export async function getLowBalances(organisationId: string, limit = 6) {
  return db
    .select({
      memberId: organisationMembers.id,
      fullName: organisationMembers.fullName,
      allowanceDkk: employeeQuotas.allowanceDkk,
      usedDkk: employeeQuotas.usedDkk,
    })
    .from(employeeQuotas)
    .innerJoin(
      organisationMembers,
      eq(employeeQuotas.memberId, organisationMembers.id),
    )
    .where(
      and(
        eq(employeeQuotas.organisationId, organisationId),
        sql`${employeeQuotas.allowanceDkk} > 0`,
        sql`${employeeQuotas.usedDkk} / ${employeeQuotas.allowanceDkk} >= 0.55`,
      ),
    )
    .orderBy(desc(sql`${employeeQuotas.usedDkk} / ${employeeQuotas.allowanceDkk}`))
    .limit(limit);
}

export async function getRecentOrders(organisationId: string, limit = 5) {
  return db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      totalDkk: orders.totalDkk,
      createdAt: orders.createdAt,
      memberName: organisationMembers.fullName,
    })
    .from(orders)
    .leftJoin(
      organisationMembers,
      eq(orders.memberId, organisationMembers.id),
    )
    .where(eq(orders.organisationId, organisationId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export async function listOrders(organisationId: string, limit = 200) {
  return db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      totalDkk: orders.totalDkk,
      glsTrackUrl: orders.glsTrackUrl,
      glsParcelNumber: orders.glsParcelNumber,
      createdAt: orders.createdAt,
      memberName: organisationMembers.fullName,
    })
    .from(orders)
    .leftJoin(
      organisationMembers,
      eq(orders.memberId, organisationMembers.id),
    )
    .where(eq(orders.organisationId, organisationId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

/** Departments with a live count of the members assigned to each. */
export async function listDepartments(organisationId: string) {
  return db
    .select({
      id: departments.id,
      name: departments.name,
      budgetDkk: departments.budgetDkk,
      budgetPeriod: departments.budgetPeriod,
      memberCount: sql<number>`(
        select count(*)::int from ${organisationMembers}
        where ${organisationMembers.departmentId} = ${departments.id}
      )`,
    })
    .from(departments)
    .where(eq(departments.organisationId, organisationId))
    .orderBy(departments.name);
}

/** Every member with their current-period quota, if one exists. */
export async function listQuotas(organisationId: string) {
  return db
    .select({
      memberId: organisationMembers.id,
      fullName: organisationMembers.fullName,
      role: organisationMembers.role,
      isActive: organisationMembers.isActive,
      quotaId: employeeQuotas.id,
      allowanceDkk: employeeQuotas.allowanceDkk,
      usedDkk: employeeQuotas.usedDkk,
      periodStart: employeeQuotas.periodStart,
      periodEnd: employeeQuotas.periodEnd,
    })
    .from(organisationMembers)
    .leftJoin(
      employeeQuotas,
      and(
        eq(employeeQuotas.memberId, organisationMembers.id),
        eq(employeeQuotas.organisationId, organisationId),
      ),
    )
    .where(eq(organisationMembers.organisationId, organisationId))
    .orderBy(organisationMembers.fullName)
    .limit(200);
}

export async function listPendingApprovals(organisationId: string) {
  return db
    .select({
      id: approvalRequests.id,
      status: approvalRequests.status,
      notes: approvalRequests.notes,
      createdAt: approvalRequests.createdAt,
      orderNumber: orders.orderNumber,
      totalDkk: orders.totalDkk,
      requesterName: organisationMembers.fullName,
    })
    .from(approvalRequests)
    .innerJoin(orders, eq(approvalRequests.orderId, orders.id))
    .leftJoin(
      organisationMembers,
      eq(approvalRequests.requestedBy, organisationMembers.id),
    )
    .where(
      and(
        eq(approvalRequests.organisationId, organisationId),
        eq(approvalRequests.status, "pending"),
      ),
    )
    .orderBy(desc(approvalRequests.createdAt))
    .limit(100);
}
