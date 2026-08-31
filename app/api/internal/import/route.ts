import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CONNECTORS, stageImport } from "@/lib/import/run";
import { enqueueNotification, opsRecipient } from "@/lib/notifications";

/**
 * Runs a supplier import on behalf of the import-cron Edge Function.
 *
 * WHY THIS EXISTS. The pipeline — FTPS, CSV/XML parsing, the diff, staging —
 * lives in lib/import/ and cannot run in Deno. Rather than keep a second
 * implementation in the Edge Function and watch the two diverge, the scheduler
 * calls the one implementation. See supabase/functions/import-cron/index.ts.
 *
 * IT STAGES ONLY. Publishing replaces what a customer's shop sells and stays a
 * deliberate human action.
 *
 * AUTHENTICATION is a shared secret compared in constant time. This route is
 * reachable from the internet, and `a === b` on a secret leaks its length and
 * its prefix to anyone willing to measure.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorised(request: Request): boolean {
  const expected = process.env.PDT_CRON_SECRET;
  // No secret configured means the endpoint is closed, not open. A deployment
  // that forgets to set it must fail shut.
  if (!expected || expected.length < 16) return false;

  const presented = request.headers.get("x-pdt-cron-secret") ?? "";
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself be a timing
  // signal; comparing a fixed-length digest of each side avoids that.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  let supplier: string;
  try {
    const body = (await request.json()) as { supplier?: string };
    supplier = String(body.supplier ?? "").toUpperCase();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!CONNECTORS[supplier]) {
    return NextResponse.json(
      { error: `Unknown supplier "${supplier}"`, known: Object.keys(CONNECTORS) },
      { status: 400 },
    );
  }

  const ops = opsRecipient();

  try {
    const run = await stageImport(supplier);

    const changed =
      run.counts.created + run.counts.updated + run.counts.discontinued;

    // Only worth an email when something actually changed. A nightly "nothing
    // happened" is how a mailbox teaches its owner to ignore the sender.
    if (ops && changed > 0) {
      await enqueueNotification(db, {
        kind: "import_staged",
        recipient: ops,
        subject: `${supplier}: ${changed} ændringer klar til gennemsyn`,
        payload: {
          supplier,
          runId: run.runId,
          created: run.counts.created,
          updated: run.counts.updated,
          discontinued: run.counts.discontinued,
        },
      });
    }

    return NextResponse.json({
      runId: run.runId,
      staged: true,
      counts: run.counts,
      skipped: run.skipped,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (ops) {
      await enqueueNotification(db, {
        kind: "import_failed",
        recipient: ops,
        subject: `${supplier}: import fejlede`,
        payload: { supplier, error: message },
      });
    }

    // 500 so the scheduler's log shows a failure rather than a quiet success.
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
