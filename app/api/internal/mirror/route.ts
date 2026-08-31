import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  mirrorPending,
  mirrorStatus,
  registerCatalogueImages,
} from "@/lib/import/images";

/**
 * Mirror newly-imported supplier images, on a schedule.
 *
 * DELIBERATELY BOUNDED. A full first pass is ~1,300 images at roughly half a
 * megabyte each, which takes far longer than any request budget allows. So this
 * registers everything outstanding and then mirrors one batch, leaving the rest
 * for the next run. A backlog drains over several nights instead of one request
 * timing out and achieving nothing.
 *
 * Incremental runs are small: only images the last import introduced are
 * outstanding, and everything already mirrored is skipped without a network
 * call.
 *
 * Same shared-secret authentication as /api/internal/import — see that route.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Leaves headroom under maxDuration so the batch always reports its result. */
const BUDGET_MS = 240_000;

function authorised(request: Request): boolean {
  const expected = process.env.PDT_CRON_SECRET;
  if (!expected || expected.length < 16) return false;

  const a = Buffer.from(request.headers.get("x-pdt-cron-secret") ?? "");
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const registered = await registerCatalogueImages();

    let mirrored = 0;
    let failed = 0;

    // Keep going while there is both work and time. Each round is small enough
    // that the budget check is meaningful.
    for (;;) {
      if (Date.now() - startedAt > BUDGET_MS) break;
      const result = await mirrorPending(50);
      mirrored += result.mirrored;
      failed += result.failed;
      if (result.claimed === 0) break;
    }

    const status = await mirrorStatus();

    return NextResponse.json({
      registered,
      mirrored,
      failed,
      remaining: status.pending,
      tookMs: Date.now() - startedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
