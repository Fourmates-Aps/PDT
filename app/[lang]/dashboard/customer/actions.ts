"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  approvalRequests,
  departments,
  employeeQuotas,
  organisationMembers,
  organisations,
  orders,
} from "@/lib/db/schema";
import { ROLES } from "@/lib/auth/roles";
import { AuthorizationError, requireRole } from "@/lib/auth/guards";
import { hasLocale, defaultLocale } from "@/lib/i18n/locales";

export type ActionState = { ok: boolean; message?: string } | null;

const ALLOWED = [ROLES.CUSTOMER_ADMIN, ROLES.ADMIN] as const;

function localeOf(formData: FormData): string {
  const v = formData.get("locale");
  return hasLocale(typeof v === "string" ? v : undefined)
    ? (v as string)
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

/**
 * The caller's own organisation, taken from their verified token.
 *
 * Never read the organisation from the submitted form: that would let a
 * customer_admin operate on another company by editing a hidden field.
 */
async function currentOrg() {
  const user = await requireRole(ALLOWED);
  if (!user.organisationId) {
    throw new AuthorizationError("No organisation on this account");
  }
  return { user, organisationId: user.organisationId };
}

function revalidate(formData: FormData, page: string) {
  revalidatePath(`/${localeOf(formData)}/dashboard/customer${page}`);
}

/* ------------------------------------------------------------------ */
/* Departments                                                         */
/* ------------------------------------------------------------------ */

export async function createDepartmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { organisationId } = await currentOrg();

    const name = String(formData.get("name") ?? "").trim();
    const budgetRaw = String(formData.get("budget") ?? "").trim();
    const period = String(formData.get("period") ?? "annual");

    if (!name) return { ok: false, message: "Name is required." };

    const budget = budgetRaw ? Number(budgetRaw.replace(",", ".")) : null;
    if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
      return { ok: false, message: "Budget must be a positive number." };
    }

    await db.insert(departments).values({
      organisationId,
      name,
      budgetDkk: budget === null ? null : budget.toFixed(2),
      budgetPeriod: period === "monthly" ? "monthly" : "annual",
    });

    revalidate(formData, "/departments");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteDepartmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { organisationId } = await currentOrg();
    const id = String(formData.get("departmentId") ?? "").trim();
    if (!id) return { ok: false, message: "Missing department." };

    // Refuse rather than silently orphaning people out of a department.
    const [{ value: memberCount }] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(organisationMembers)
      .where(eq(organisationMembers.departmentId, id));

    if (memberCount > 0) {
      return {
        ok: false,
        message: "This department still has employees. Move them first.",
      };
    }

    await db
      .delete(departments)
      .where(
        and(
          eq(departments.id, id),
          // Scoped so a crafted id from another organisation cannot be deleted.
          eq(departments.organisationId, organisationId),
        ),
      );

    revalidate(formData, "/departments");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------------ */
/* Clothing account                                                    */
/* ------------------------------------------------------------------ */

export async function setQuotaAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { organisationId } = await currentOrg();

    const memberId = String(formData.get("memberId") ?? "").trim();
    const amountRaw = String(formData.get("allowance") ?? "").trim();
    if (!memberId) return { ok: false, message: "Missing employee." };

    const amount = Number(amountRaw.replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) {
      return { ok: false, message: "Allowance must be a positive number." };
    }

    // Confirm the member really belongs to the caller's organisation.
    const [member] = await db
      .select({ id: organisationMembers.id })
      .from(organisationMembers)
      .where(
        and(
          eq(organisationMembers.id, memberId),
          eq(organisationMembers.organisationId, organisationId),
        ),
      )
      .limit(1);

    if (!member) return { ok: false, message: "Employee not found." };

    const now = new Date();
    const periodStart = `${now.getFullYear()}-01-01`;
    const periodEnd = `${now.getFullYear()}-12-31`;

    await db
      .insert(employeeQuotas)
      .values({
        organisationId,
        memberId,
        periodStart,
        periodEnd,
        allowanceDkk: amount.toFixed(2),
        usedDkk: "0",
      })
      .onConflictDoUpdate({
        target: [employeeQuotas.memberId, employeeQuotas.periodStart],
        set: { allowanceDkk: amount.toFixed(2) },
      });

    revalidate(formData, "/clothing-account");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------------ */
/* Approvals                                                           */
/* ------------------------------------------------------------------ */

export async function decideApprovalAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { user, organisationId } = await currentOrg();

    const id = String(formData.get("approvalId") ?? "").trim();
    const decision = String(formData.get("decision") ?? "");
    const notes = String(formData.get("notes") ?? "").trim();

    if (!id) return { ok: false, message: "Missing request." };
    if (decision !== "approved" && decision !== "rejected") {
      return { ok: false, message: "Unknown decision." };
    }

    const [request] = await db
      .select({
        id: approvalRequests.id,
        orderId: approvalRequests.orderId,
        requestedBy: approvalRequests.requestedBy,
        status: approvalRequests.status,
      })
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.id, id),
          eq(approvalRequests.organisationId, organisationId),
        ),
      )
      .limit(1);

    if (!request) return { ok: false, message: "Request not found." };
    if (request.status !== "pending") {
      return { ok: false, message: "This request has already been decided." };
    }

    // Who is deciding, as a member row.
    const [approver] = await db
      .select({ id: organisationMembers.id })
      .from(organisationMembers)
      .where(
        and(
          eq(organisationMembers.userId, user.id),
          eq(organisationMembers.organisationId, organisationId),
        ),
      )
      .limit(1);

    // Nobody signs off their own spend, mirroring the RLS policy on this table.
    if (approver && approver.id === request.requestedBy) {
      return { ok: false, message: "You cannot decide your own request." };
    }

    await db
      .update(approvalRequests)
      .set({
        status: decision,
        approverId: approver?.id ?? null,
        notes: notes || null,
        decidedAt: new Date(),
      })
      .where(eq(approvalRequests.id, request.id));

    const [order] = await db
      .select({
        id: orders.id,
        memberId: orders.memberId,
        accountAmountDkk: orders.accountAmountDkk,
      })
      .from(orders)
      .where(
        and(
          eq(orders.id, request.orderId),
          eq(orders.organisationId, organisationId),
        ),
      )
      .limit(1);

    await db
      .update(orders)
      .set({
        status: decision === "approved" ? "approved" : "cancelled",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orders.id, request.orderId),
          eq(orders.organisationId, organisationId),
        ),
      );

    // Checkout reserves the allowance when the order is placed, so a rejection
    // has to give it back — otherwise the employee is charged budget for an
    // order that will never ship. Floored at zero so a double-reject or a
    // manual adjustment can never push used_dkk negative.
    if (decision === "rejected" && order?.memberId) {
      const released = Number(order.accountAmountDkk);
      if (released > 0) {
        await db
          .update(employeeQuotas)
          .set({
            usedDkk: sql`greatest(0, ${employeeQuotas.usedDkk} - ${released.toFixed(2)})`,
          })
          .where(
            and(
              eq(employeeQuotas.memberId, order.memberId),
              eq(employeeQuotas.organisationId, organisationId),
            ),
          );
      }
    }

    revalidate(formData, "/approvals");
    revalidate(formData, "");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export async function updateSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { organisationId } = await currentOrg();

    const mode = String(formData.get("displayMode") ?? "price");
    const allowanceRaw = String(formData.get("defaultAllowance") ?? "").trim();
    const limitRaw = String(formData.get("orderLimit") ?? "").trim();
    const personal = formData.get("allowPersonal") === "on";

    const allowance = Number(allowanceRaw.replace(",", "."));
    const limit = Number(limitRaw.replace(",", "."));

    if (!Number.isFinite(allowance) || allowance < 0) {
      return { ok: false, message: "Allowance must be a positive number." };
    }
    if (!Number.isFinite(limit) || limit < 0) {
      return { ok: false, message: "Spending cap must be a positive number." };
    }

    await db
      .update(organisations)
      .set({
        displayMode: mode === "points" ? "points" : "price",
        defaultAllowanceDkk: allowance.toFixed(2),
        orderApprovalLimitDkk: limit.toFixed(2),
        allowPersonalPurchases: personal,
        updatedAt: new Date(),
      })
      .where(eq(organisations.id, organisationId));

    revalidate(formData, "/settings");
    revalidate(formData, "");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
