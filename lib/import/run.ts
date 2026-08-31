import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { importChanges, importRuns } from "@/lib/db/schema";
import { diffFeed, loadCurrent, type Change } from "./diff";
import { publishChanges } from "./publish";
import { fristadsConnector } from "./connectors/fristads";
import { fhYouConnector } from "./connectors/fh-you";
import type { Connector, ConnectorOptions } from "./types";

/**
 * One import, start to finish.
 *
 * A run STOPS AT `staged`. SuuplierIntegration.md asks for a notification when a
 * supplier delivers a new catalogue and a replacement only "on acceptance", so
 * publishing is a second, deliberate call by a person. An importer that pushes
 * straight to the live shop is one malformed feed away from emptying it — and
 * the feed is a file on someone else's server that we do not control.
 */

export const CONNECTORS: Record<string, Connector> = {
  FRISTADS: fristadsConnector,
  FH_YOU: fhYouConnector,
};

export type StagedRun = {
  runId: string;
  supplierId: string;
  source: string;
  counts: { created: number; updated: number; discontinued: number; unchanged: number };
  skipped: number;
  changes: Change[];
};

/** Fetch, diff and record — without touching the catalogue. */
export async function stageImport(
  supplierId: string,
  options: ConnectorOptions = {},
): Promise<StagedRun> {
  const connector = CONNECTORS[supplierId];
  if (!connector) {
    throw new Error(
      `No connector for "${supplierId}". Available: ${Object.keys(CONNECTORS).join(", ")}`,
    );
  }

  const [run] = await db
    .insert(importRuns)
    .values({ supplierId, status: "running", source: "(fetching)" })
    .returning({ id: importRuns.id });

  try {
    const feed = await connector.fetch(options);
    const current = await loadCurrent(supplierId);
    const diff = diffFeed(feed.products, current);

    /*
     * Only real changes are recorded. Writing an `unchanged` row per product
     * would add hundreds of rows per run that say nothing happened, and bury the
     * handful a reviewer needs to look at.
     */
    const notable = diff.changes.filter((c) => c.type !== "unchanged");

    if (notable.length > 0) {
      await db.insert(importChanges).values(
        notable.map((change) => ({
          runId: run.id,
          changeType: change.type,
          supplierSku: change.supplierSku,
          productId: change.productId,
          before: change.before,
          after: change.after,
          summary: change.summary,
        })),
      );
    }

    await db
      .update(importRuns)
      .set({
        status: "staged",
        source: feed.source,
        created: diff.counts.created,
        updated: diff.counts.updated,
        discontinued: diff.counts.discontinued,
        unchanged: diff.counts.unchanged,
        skipped: feed.skipped.length > 0 ? feed.skipped.slice(0, 200) : null,
        stagedAt: new Date(),
      })
      .where(eq(importRuns.id, run.id));

    return {
      runId: run.id,
      supplierId,
      source: feed.source,
      counts: diff.counts,
      skipped: feed.skipped.length,
      changes: diff.changes,
    };
  } catch (error) {
    // The run row survives the failure on purpose: "the Tuesday import blew up
    // and nobody noticed" is the failure mode this table exists to prevent.
    await db
      .update(importRuns)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      })
      .where(eq(importRuns.id, run.id));
    throw error;
  }
}

/**
 * Apply a staged run.
 *
 * Re-diffs from the stored changes rather than re-fetching: the reviewer
 * approved THAT diff, and a feed that moved in the meantime would publish
 * something nobody looked at.
 */
export async function publishRun(
  runId: string,
  decidedBy?: string,
): Promise<{ created: number; updated: number; discontinued: number }> {
  const [run] = await db
    .select()
    .from(importRuns)
    .where(eq(importRuns.id, runId))
    .limit(1);

  if (!run) throw new Error(`Import run ${runId} not found`);
  if (run.status !== "staged") {
    throw new Error(
      `Import run ${runId} is "${run.status}", not "staged" — only a staged run can be published.`,
    );
  }

  await db
    .update(importRuns)
    .set({ status: "publishing" })
    .where(eq(importRuns.id, runId));

  try {
    const rows = await db
      .select()
      .from(importChanges)
      .where(eq(importChanges.runId, runId));

    const changes = rows.map((row) => ({
      type: row.changeType,
      supplierSku: row.supplierSku,
      productId: row.productId,
      before: row.before,
      after: row.after,
      summary: row.summary ?? "",
    })) as Change[];

    const result = await publishChanges(run.supplierId, changes);

    await db
      .update(importRuns)
      .set({
        status: "published",
        decidedBy: decidedBy ?? null,
        decidedAt: new Date(),
        publishedAt: new Date(),
      })
      .where(eq(importRuns.id, runId));

    return result;
  } catch (error) {
    await db
      .update(importRuns)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      })
      .where(eq(importRuns.id, runId));
    throw error;
  }
}

/** Turn down a staged run. The diff is kept as the record of what was refused. */
export async function rejectRun(
  runId: string,
  decidedBy?: string,
): Promise<void> {
  await db
    .update(importRuns)
    .set({
      status: "rejected",
      decidedBy: decidedBy ?? null,
      decidedAt: new Date(),
    })
    .where(eq(importRuns.id, runId));
}
