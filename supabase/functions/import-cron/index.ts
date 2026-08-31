import { ok, rejected } from "../_shared/http.ts";
import { optional, required } from "../_shared/env.ts";

/**
 * Nightly supplier feeds.
 *
 * WHY THIS ONE IS A THIN CALLER. The other functions do their work here, but the
 * import pipeline genuinely cannot: fetching over FTPS, parsing CSV and XML,
 * folding Danish characters in supplier headers, diffing against the live
 * catalogue and staging the result are several hundred lines of TypeScript in
 * lib/import/, and Deno cannot import them. Rewriting that in Deno would leave
 * two implementations of the same diff, and the day they disagree is the day a
 * customer's shop empties itself.
 *
 * So this function is a scheduler, not an importer. It calls the Next app, which
 * owns the pipeline, and reports what came back.
 *
 * IT STAGES, IT DOES NOT PUBLISH. SuuplierIntegration.md asks for a notification
 * when a supplier delivers a new catalogue and a replacement only on acceptance.
 * A cron job that published straight to the live shop would be one malformed
 * feed away from emptying it — and the feed is a file on somebody else's server.
 */

const SUPPLIERS = (optional("PDT_IMPORT_SUPPLIERS", "FRISTADS"))
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return rejected("POST only", 405);

  const base = required("PDT_APP_URL").replace(/\/$/, "");
  const secret = required("PDT_CRON_SECRET");

  const results: Record<string, unknown>[] = [];

  for (const supplier of SUPPLIERS) {
    try {
      const response = await fetch(`${base}/api/internal/import`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // The app checks this in constant time. It is the only thing standing
          // between the open internet and a supplier import.
          "x-pdt-cron-secret": secret,
        },
        body: JSON.stringify({ supplier }),
      });

      const detail = await response.json().catch(() => ({}));
      results.push({ supplier, status: response.status, ...detail });

      if (!response.ok) {
        console.error(`Import ${supplier} returned ${response.status}`);
      }
    } catch (error) {
      // One supplier's server being unreachable must not stop the others.
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Import ${supplier} failed: ${message}`);
      results.push({ supplier, error: message });
    }
  }

  return ok({ ran: SUPPLIERS.length, results });
});
