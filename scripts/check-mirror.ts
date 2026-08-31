import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { mediaAssets } from "@/lib/db/schema";
import {
  isPermanentStatus,
  mirrorPending,
  storagePathFor,
} from "@/lib/import/images";

/**
 * The image mirror's guards.
 *
 *   npm run check:mirror
 *
 * Two things are checked, and both are about what the mirror REFUSES to do.
 *
 * SSRF. These URLs come out of a supplier's feed file — third-party input
 * reaching a server-side fetch. A feed naming the cloud metadata address would
 * otherwise have this process read instance credentials and publish them to a
 * public bucket.
 *
 * RETRY BUDGET. A rate limit must not count as a strike. Concurrency of 12
 * against you.dk produced 39 failures out of 60; if those had burned attempts,
 * three busy nights would have permanently abandoned good images.
 */

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

/** Queue one URL, run the mirror over it, and report how it was recorded. */
async function attempt(url: string) {
  await db.execute(sql`delete from media_assets where source_url = ${url}`);
  await db.insert(mediaAssets).values({ sourceUrl: url });
  // Targeted, so testing one URL does not mirror the live backlog.
  await mirrorPending(5, 2, [url]);
  const [row] = await db.execute<{
    mirrored_at: string | null;
    attempts: number;
    last_error: string | null;
  }>(sql`
    select mirrored_at, attempts, last_error from media_assets where source_url = ${url}
  `);
  await db.execute(sql`delete from media_assets where source_url = ${url}`);
  return row;
}

async function main() {
  console.log("\nSSRF — addresses the mirror must refuse:");

  const blocked = [
    ["cloud metadata", "https://169.254.169.254/latest/meta-data/"],
    ["loopback", "https://127.0.0.1/secret.jpg"],
    ["private RFC1918", "https://10.0.0.5/internal.jpg"],
    ["private 192.168", "https://192.168.1.1/router.jpg"],
    ["plain http", "http://example.com/image.jpg"],
    ["file scheme", "file:///etc/passwd"],
  ] as const;

  for (const [label, url] of blocked) {
    const row = await attempt(url);
    const refused = row?.mirrored_at === null;
    check(
      `${label} refused`,
      refused,
      row?.last_error ?? "(no error recorded)",
    );
  }

  // localhost resolves to 127.0.0.1, so the DNS check must catch it by name.
  const byName = await attempt("https://localhost/x.jpg");
  check(
    "a hostname resolving to loopback is refused",
    byName?.mirrored_at === null,
    byName?.last_error ?? "",
  );

  console.log("\nRetry budget — a rate limit is not a strike:");
  // Classification is tested directly rather than through a third-party status
  // service, which would make the check depend on somebody else's uptime.
  check("429 is transient", isPermanentStatus(429) === false);
  check("503 is transient", isPermanentStatus(503) === false);
  check("500 is transient", isPermanentStatus(500) === false);
  check("404 is permanent", isPermanentStatus(404) === true);
  check("403 (hotlink protection) is permanent", isPermanentStatus(403) === true);

  console.log("\nStorage paths:");
  const a = storagePathFor("https://you.dk/static/abc.jpg");
  const b = storagePathFor("https://you.dk/static/abc.jpg");
  const c = storagePathFor("https://you.dk/static/def.png");
  check("same URL gives the same path", a === b, a);
  check("different URLs give different paths", a !== c);
  check("extension is preserved", c.endsWith(".png"), c);
  check("paths are fanned out into directories", a.split("/").length === 3, a);

  console.log("\nErrors stored are ours, not upstream bytes:");
  const clean = await attempt("https://169.254.169.254/x.jpg");
  check(
    "no newlines or raw body in last_error",
    !!clean?.last_error && !/[\r\n]/.test(clean.last_error) && clean.last_error.length <= 200,
    clean?.last_error ?? "",
  );

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  if (failures > 0) process.exitCode = 1;
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
