import "server-only";
import { createHash } from "node:crypto";
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
  const response = await fetch(sourceUrl, {
    // Suppliers serve these to browsers; some reject an unidentified client.
    headers: { accept: "image/*,*/*" },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`source returned ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) {
    // Hotlink protection usually announces itself as an HTML error page with a
    // 200, which would otherwise be stored as a corrupt "image".
    throw new Error(`source returned ${contentType}, not an image`);
  }

  const body = new Uint8Array(await response.arrayBuffer());
  if (body.byteLength === 0) throw new Error("source returned 0 bytes");
  if (body.byteLength > MAX_BYTES) {
    throw new Error(`source returned ${body.byteLength} bytes, over the limit`);
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
): Promise<MirrorResult> {
  const pending = await db
    .select({ id: mediaAssets.id, sourceUrl: mediaAssets.sourceUrl })
    .from(mediaAssets)
    .where(
      and(
        isNull(mediaAssets.mirroredAt),
        lt(mediaAssets.attempts, MAX_ATTEMPTS),
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
        await db
          .update(mediaAssets)
          .set({
            attempts: sql`${mediaAssets.attempts} + 1`,
            lastError: message.slice(0, 300),
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
