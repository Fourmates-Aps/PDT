import "server-only";
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { and, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { mediaAssets } from "@/lib/db/schema";

/**
 * Copying supplier images into our own storage.
 *
 * The catalogue currently hotlinks every photograph from the supplier's CDN, so
 * how the shop looks depends on somebody else's uptime and their tolerance for
 * being hotlinked. Mirroring removes both dependencies. See lib/db/schema/media.ts
 * for why the mapping lives in its own table rather than in a column.
 *
 * IDEMPOTENT AND RESUMABLE. Work is claimed from the table, not from a list held
 * in memory, so a run that dies halfway loses nothing and the next one continues.
 * Anything already mirrored is skipped without a network call.
 */

const BUCKET = "catalogue";
const MAX_ATTEMPTS = 3;
const MAX_BYTES = 10 * 1024 * 1024;
/** Redirect hops to follow before giving up. Each one is re-validated. */
const MAX_REDIRECTS = 3;

/**
 * A failure that will never succeed — a 404, or a URL we refuse on principle.
 *
 * Separated from transient failures because they are counted differently: a
 * permanent error burns the retry budget, a temporary one does not. Concurrency
 * of 12 against you.dk produced 39 rate-limit failures out of 60, and counting
 * those would have permanently abandoned 39 perfectly good images after three
 * such nights.
 */
class PermanentImageError extends Error {}

/**
 * Whether an HTTP status will still be failing tomorrow.
 *
 * 404 and 410 are the server saying the file is gone. 429 and 5xx are it asking
 * us to come back later, and those must not count against the retry budget.
 * Other 4xx (401/403) usually mean hotlink protection, which is a standing
 * policy rather than a blip — so they count.
 */
export function isPermanentStatus(status: number): boolean {
  if (status === 429) return false;
  if (status >= 500) return false;
  return status >= 400;
}

/** Keep stored errors short and free of upstream response bodies. */
function sanitiseError(message: string): string {
  return message.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").slice(0, 200);
}

/**
 * Refuse to fetch anything that is not a public internet address.
 *
 * These URLs arrive in a supplier's feed file, so they are third-party input
 * reaching a server-side fetch — the classic SSRF shape. Without this, a feed
 * naming http://169.254.169.254/... would have this process read cloud instance
 * metadata and store it in a public bucket, and one naming an internal host
 * would turn the importer into a proxy into our own network.
 *
 * Every hop is checked, not just the first: a public URL is free to redirect to
 * a private one, which is why redirects are followed manually below.
 */
async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PermanentImageError("not a valid URL");
  }

  // Supplier CDNs all serve https. Allowing http would also allow a plaintext
  // hop that anyone on the path could redirect.
  if (url.protocol !== "https:") {
    throw new PermanentImageError(`refused protocol ${url.protocol}`);
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true }).catch(() => {
        throw new PermanentImageError(`cannot resolve ${host}`);
      });

  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new PermanentImageError(`refused private address ${address}`);
    }
  }

  return url;
}

function isPrivateAddress(ip: string): boolean {
  if (ip === "0.0.0.0" || ip === "::" || ip === "::1") return true;

  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  const parts = v4.split(".").map(Number);

  if (parts.length === 4 && parts.every((n) => Number.isInteger(n))) {
    const [a, b] = parts;
    if (a === 127 || a === 10 || a === 0) return true;            // loopback, RFC1918, unspecified
    if (a === 172 && b >= 16 && b <= 31) return true;             // RFC1918
    if (a === 192 && b === 168) return true;                      // RFC1918
    if (a === 169 && b === 254) return true;                      // link-local, incl. cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true;            // CGNAT
    return false;
  }

  const v6 = ip.toLowerCase();
  return (
    v6.startsWith("fe80") ||  // link-local
    v6.startsWith("fc") ||    // unique local
    v6.startsWith("fd")
  );
}

function storageBase(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return `${url.replace(/\/$/, "")}/storage/v1`;
}

function serviceKey(): string {
  const key = process.env.SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SERVICE_KEY is not set — see .env.example");
  return key;
}

/**
 * A stable path for a source URL.
 *
 * Content-addressed by the URL rather than named after the product: the same
 * file is shared by hundreds of variants, and a product-based name would either
 * collide or store the same bytes many times over. The extension is preserved
 * so the CDN serves a sensible content type.
 */
export function storagePathFor(sourceUrl: string): string {
  const hash = createHash("sha256").update(sourceUrl).digest("hex").slice(0, 32);
  const ext = (sourceUrl.match(/\.(jpe?g|png|webp|avif|gif)(?:\?|$)/i)?.[1] ?? "jpg")
    .toLowerCase()
    .replace("jpeg", "jpg");
  // Two levels of fan-out: object stores and file browsers both cope badly with
  // one directory holding tens of thousands of entries.
  return `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}.${ext}`;
}

/**
 * Record every image URL the catalogue currently references.
 *
 * Registration is separate from fetching so the queue is complete and visible
 * before any network work starts — "how many images are we missing?" is then a
 * query rather than a guess.
 */
export async function registerCatalogueImages(): Promise<number> {
  const rows = await db.execute<{ url: string }>(sql`
    select distinct url from (
      select primary_image as url from products where primary_image is not null
      union
      select unnest(image_urls) as url from product_variants where image_urls is not null
    ) t
    where url like 'http%'
  `);

  if (rows.length === 0) return 0;

  // Chunked: 12,000 URLs in one INSERT would blow past the bind-parameter cap.
  const CHUNK = 1000;
  let added = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK).map((r) => ({ sourceUrl: r.url }));
    const inserted = await db
      .insert(mediaAssets)
      .values(slice)
      .onConflictDoNothing({ target: mediaAssets.sourceUrl })
      .returning({ id: mediaAssets.id });
    added += inserted.length;
  }
  return added;
}

export type MirrorResult = {
  claimed: number;
  mirrored: number;
  failed: number;
};

/** Fetch one image and put it in the bucket. */
async function mirrorOne(sourceUrl: string): Promise<{
  storagePath: string;
  publicUrl: string;
  contentType: string;
  bytes: number;
}> {
  /*
   * Redirects are followed BY HAND so every hop can be re-validated. Letting
   * fetch follow them would check only the first URL, and a public URL is free
   * to redirect to 169.254.169.254.
   */
  let target = await assertPublicUrl(sourceUrl);
  let response: Response | null = null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    response = await fetch(target, {
      // Suppliers serve these to browsers; some reject an unidentified client.
      headers: { accept: "image/*,*/*" },
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });

    if (response.status < 300 || response.status >= 400) break;

    const location = response.headers.get("location");
    if (!location) throw new PermanentImageError("redirect without a location");
    target = await assertPublicUrl(new URL(location, target).toString());
    response = null;
  }

  if (!response) {
    throw new PermanentImageError(`more than ${MAX_REDIRECTS} redirects`);
  }

  if (!response.ok) {
    const message = `source returned ${response.status}`;
    throw isPermanentStatus(response.status)
      ? new PermanentImageError(message)
      : new Error(message);
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) {
    // Hotlink protection usually announces itself as an HTML error page with a
    // 200, which would otherwise be stored as a corrupt "image".
    throw new PermanentImageError(
      `source returned ${contentType}, not an image`,
    );
  }

  const body = new Uint8Array(await response.arrayBuffer());
  if (body.byteLength === 0) {
    throw new PermanentImageError("source returned 0 bytes");
  }
  if (body.byteLength > MAX_BYTES) {
    throw new PermanentImageError(
      `source returned ${body.byteLength} bytes, over the limit`,
    );
  }

  const path = storagePathFor(sourceUrl);
  const upload = await fetch(`${storageBase()}/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${serviceKey()}`,
      "content-type": contentType,
      // Re-running must overwrite rather than fail on an existing object.
      "x-upsert": "true",
    },
    body,
  });

  if (!upload.ok) {
    throw new Error(`upload failed ${upload.status}: ${(await upload.text()).slice(0, 200)}`);
  }

  return {
    storagePath: path,
    publicUrl: `${storageBase()}/object/public/${BUCKET}/${path}`,
    contentType,
    bytes: body.byteLength,
  };
}

/**
 * Mirror a batch of outstanding images.
 *
 * Bounded concurrency: suppliers are not obliged to tolerate us pulling
 * thousands of files at once, and a mirror that gets us rate-limited or blocked
 * has caused the exact problem it exists to prevent.
 */
export async function mirrorPending(
  limit = 200,
  concurrency = 6,
  /** Restrict to these source URLs. Used by checks so they do not drain the
   *  live queue as a side effect of testing one URL. */
  onlyUrls?: string[],
): Promise<MirrorResult> {
  const pending = await db
    .select({ id: mediaAssets.id, sourceUrl: mediaAssets.sourceUrl })
    .from(mediaAssets)
    .where(
      and(
        isNull(mediaAssets.mirroredAt),
        lt(mediaAssets.attempts, MAX_ATTEMPTS),
        ...(onlyUrls ? [inArray(mediaAssets.sourceUrl, onlyUrls)] : []),
      ),
    )
    .limit(limit);

  const result: MirrorResult = { claimed: pending.length, mirrored: 0, failed: 0 };
  if (pending.length === 0) return result;

  let cursor = 0;
  async function worker() {
    while (cursor < pending.length) {
      const item = pending[cursor++];
      try {
        const stored = await mirrorOne(item.sourceUrl);
        await db
          .update(mediaAssets)
          .set({
            storagePath: stored.storagePath,
            publicUrl: stored.publicUrl,
            contentType: stored.contentType,
            bytes: stored.bytes,
            mirroredAt: new Date(),
            lastError: null,
            attempts: sql`${mediaAssets.attempts} + 1`,
          })
          .where(eq(mediaAssets.id, item.id));
        result.mirrored++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        /*
         * Only a permanent failure counts against MAX_ATTEMPTS. A rate limit or
         * a 503 is the supplier asking us to come back later, and treating that
         * as strike one would abandon a perfectly good image after three busy
         * nights — which is exactly what a concurrency of 12 produced against
         * you.dk: 39 rate-limit failures out of 60.
         */
        const permanent = error instanceof PermanentImageError;
        await db
          .update(mediaAssets)
          .set({
            ...(permanent ? { attempts: sql`${mediaAssets.attempts} + 1` } : {}),
            // Our own message, never raw upstream bytes: this column is
            // queryable and a supplier error page should not land in it.
            lastError: sanitiseError(message),
          })
          .where(eq(mediaAssets.id, item.id));
        result.failed++;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, pending.length) }, worker),
  );

  return result;
}

/**
 * Swap supplier URLs for mirrored ones.
 *
 * Returns a map of source URL → our URL for everything already mirrored. Callers
 * fall back to the supplier URL for anything missing, so an incomplete mirror
 * degrades to today's behaviour rather than to blank frames.
 */
export async function resolveMirrored(
  urls: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const wanted = [...new Set(urls.filter((u): u is string => Boolean(u)))];
  if (wanted.length === 0) return new Map();

  const rows = await db
    .select({ sourceUrl: mediaAssets.sourceUrl, publicUrl: mediaAssets.publicUrl })
    .from(mediaAssets)
    .where(
      and(
        inArray(mediaAssets.sourceUrl, wanted),
        isNotNull(mediaAssets.mirroredAt),
      ),
    );

  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.publicUrl) map.set(row.sourceUrl, row.publicUrl);
  }
  return map;
}

/** How far along the mirror is — used by the CLI and the health check. */
export async function mirrorStatus(): Promise<{
  total: number;
  mirrored: number;
  failed: number;
  pending: number;
  bytes: number;
}> {
  const [row] = await db.execute<{
    total: number;
    mirrored: number;
    failed: number;
    pending: number;
    bytes: number;
  }>(sql`
    select count(*)::int as total,
           count(mirrored_at)::int as mirrored,
           count(*) filter (where mirrored_at is null and attempts >= ${MAX_ATTEMPTS})::int as failed,
           count(*) filter (where mirrored_at is null and attempts < ${MAX_ATTEMPTS})::int as pending,
           coalesce(sum(bytes), 0)::bigint as bytes
      from media_assets
  `);
  return {
    total: Number(row.total),
    mirrored: Number(row.mirrored),
    failed: Number(row.failed),
    pending: Number(row.pending),
    bytes: Number(row.bytes),
  };
}
