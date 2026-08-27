import "server-only";
import { db } from "@/lib/db";
import { auditLog } from "@/lib/db/schema";

/**
 * Writes one line to the audit trail.
 *
 * Deliberately **cannot fail the caller**. An audit write that throws would roll
 * back the very change it was recording, so a staff role change would fail
 * because the log was unavailable. The write is best-effort and any failure is
 * reported to the server console instead.
 *
 * That is a trade, and it is the right way round for this table: a missing line
 * is a gap someone can investigate, whereas a refused role change is an outage.
 * Where a stricter guarantee is needed later — approvals, price overrides — the
 * write belongs inside the same transaction as the change, not here.
 */
export async function recordAudit(entry: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  /** A complete sentence, composed now, in Danish. */
  summary: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorUserId: entry.actorUserId ?? null,
      actorEmail: entry.actorEmail ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      metadata: entry.metadata ?? null,
    });
  } catch (error) {
    console.error(
      `[audit] failed to record ${entry.action}:`,
      error instanceof Error ? error.message : error,
    );
  }
}
