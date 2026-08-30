import "server-only";
import { Redis } from "@upstash/redis";

/**
 * A shared, cross-instance cache on Upstash Redis.
 *
 * WHY THIS AND NOT `unstable_cache`. Next's cache is per deployment: every
 * instance keeps its own copy, and every deploy starts cold. For a catalogue
 * read that is identical for every visitor, that means N instances each paying
 * for the same query, N times over, after every release. Redis is one copy that
 * all of them share and that survives a deploy — the same reasoning that put the
 * rate limiter in Postgres rather than in a Map.
 *
 * INVALIDATION IS BY TAG VERSION, NOT BY KEY DELETION. Each tag owns a counter;
 * the counter's current value is part of every key built under it. Invalidating
 * is one INCR, after which every old key is simply unreachable and expires on
 * its own TTL. The alternative — tracking the key set per tag and deleting it —
 * needs a second data structure kept perfectly in sync, and `SCAN` over a
 * keyspace to find stragglers is exactly the operation you must not run on a
 * shared Redis.
 *
 * IT FAILS OPEN. Every path here falls back to querying the source directly if
 * Redis is missing, slow or broken. A cache that takes the site down when it is
 * unavailable has done more damage than the load it was there to absorb.
 *
 * ⚠ VALUES MUST BE JSON-SAFE. The SDK serialises to JSON, so a `Date` comes back
 * as a string and a `Map` comes back as `{}`. Everything cached today is strings,
 * numbers and arrays of them; anything with a Date needs to serialise it
 * explicitly before it goes in.
 */

/**
 * Redis is skipped while Next is PRERENDERING.
 *
 * The Upstash SDK talks over HTTP with `cache: "no-store"`, and a no-store fetch
 * inside a statically rendered route drops that route out of static rendering.
 * Wiring the cache in without this guard turned every public page from `●`
 * (prerendered HTML) into `ƒ` (rendered per request) — a downgrade, not an
 * upgrade, since a statically rendered page is ALREADY cached, as HTML, at the
 * edge.
 *
 * So the two caches divide the work: prerendered pages read the database once at
 * build or revalidation time, and Redis serves the routes that genuinely run per
 * request — search, category, product and group pages — where it is also shared
 * across instances.
 */
function prerendering(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

let client: Redis | null | undefined;

/**
 * The Redis client, or null when the project has no credentials.
 *
 * Resolved once and remembered — including the null — so a project running
 * without Redis does not re-check the environment on every call.
 */
function redis(): Redis | null {
  if (prerendering()) return null;
  if (client !== undefined) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  client =
    url && token
      ? new Redis({
          url,
          token,
          /*
           * One quick retry, not the SDK's default five with backoff.
           *
           * Measured: with Redis unreachable, the defaults took 8.6 SECONDS to
           * give up. The fallback still worked, but "fails open" is worthless if
           * it fails open slowly — an outage would have turned every page into
           * an 8-second wait instead of an uncached one.
           */
          retry: { retries: 1, backoff: () => 50 },
        })
      : null;

  if (!client) {
    console.info("[cache] no Upstash credentials — reads go straight to source");
  }
  return client;
}

/** Namespaced so this database can be shared without keys colliding. */
const PREFIX = "pdt";

const versionKey = (tag: string) => `${PREFIX}:ver:${tag}`;

/**
 * The current version of a tag. Absent means ZERO, not one.
 *
 * That zero matters. `INCR` on a missing key returns 1, so if the default were
 * also 1 the FIRST invalidation would move the version from 1 to 1 — no key
 * would change, and every stale entry would keep being served until its TTL ran
 * out. Starting at 0 makes the first INCR a real change like every later one.
 *
 * A missing counter is not an error; it means nothing has been invalidated yet.
 * Writing it eagerly would cost a round trip on every cold start.
 */
const VERSION_TTL_MS = 10_000;
const versionCache = new Map<string, { value: number; expires: number }>();

async function tagVersion(tag: string): Promise<number> {
  const r = redis();
  if (!r) return 0;

  /*
   * The version is held in process for ten seconds.
   *
   * Without this every cache read costs TWO sequential round trips — one for the
   * version, one for the value — which at the measured 256ms each is slower than
   * the Postgres query being cached. Now a warm hit is one round trip.
   *
   * The cost is that an invalidation can take up to ten seconds to reach every
   * instance. For a catalogue that imports overnight that is nothing; for
   * anything where a stale read is a correctness problem it would not be.
   */
  const now = Date.now();
  const memo = versionCache.get(tag);
  if (memo && memo.expires > now) return memo.value;

  try {
    const value = await withDeadline(r.get<number>(versionKey(tag)), "version");
    const resolved =
      typeof value === "number" && Number.isFinite(value)
        ? value
        : // A timeout or a missing key must NOT collapse to 0 when a version is
          // already known: that would read a different namespace and miss every
          // key. Last known wins; only a genuinely fresh start uses 0.
          (memo?.value ?? 0);
    versionCache.set(tag, { value: resolved, expires: now + VERSION_TTL_MS });
    return resolved;
  } catch (error) {
    console.error("[cache] version read failed", { tag, error });
    return memo?.value ?? 0;
  }
}

/**
 * Retire everything stored under a tag.
 *
 * One INCR. The old entries are orphaned immediately and Redis reclaims them
 * when their TTL runs out.
 */
export async function invalidateTag(tag: string): Promise<void> {
  const r = redis();
  if (!r) return;
  try {
    const next = await r.incr(versionKey(tag));
    // Adopt it immediately on this instance rather than waiting out the memo.
    versionCache.set(tag, { value: next, expires: Date.now() + VERSION_TTL_MS });
  } catch (error) {
    versionCache.delete(tag);
    // Worth shouting about: a failed invalidation means stale data is being
    // served, which is harder to notice than an outright error.
    console.error("[cache] invalidation FAILED — stale data may be served", {
      tag,
      error,
    });
  }
}

/**
 * In-flight requests for the same key, within this instance.
 *
 * On a cold key, ten concurrent requests would otherwise all miss and all query
 * the database. This collapses them into one. It is per-instance, so it does not
 * prevent a stampede ACROSS instances — that needs a distributed lock, which
 * costs a round trip on every miss and is not worth it for a catalogue read that
 * takes milliseconds.
 */
const inFlight = new Map<string, Promise<unknown>>();

/**
 * The longest any single Redis call may hold up a request.
 *
 * Bounds the SLOW case, which is the one with no error to catch. Set well above
 * real latency on purpose: an earlier attempt used 250ms, and the measured round
 * trip to this Upstash region is 256ms — so the deadline fired on EVERY call,
 * every read became a miss, and the cache silently stopped caching while looking
 * healthy. A ceiling has to sit above the thing it is a ceiling on.
 */
const DEADLINE_MS = 1000;

function withDeadline<T>(work: Promise<T>, label: string): Promise<T | null> {
  return Promise.race([
    work,
    new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn("[cache] slow, giving up on", label);
        resolve(null);
      }, DEADLINE_MS),
    ),
  ]);
}

export type CacheOptions = {
  /** Seconds. */
  ttl: number;
  tag: string;
};

/**
 * Cache-aside: return the cached value, or compute it, store it and return it.
 *
 * `key` must already identify the arguments — see `cacheKey`.
 */
export async function cached<T>(
  key: string,
  compute: () => Promise<T>,
  { ttl, tag }: CacheOptions,
): Promise<T> {
  const r = redis();
  if (!r) return compute();

  const version = await tagVersion(tag);
  const full = `${PREFIX}:${tag}:v${version}:${key}`;

  try {
    const hit = await withDeadline(r.get<T>(full), full);
    // `null` is ambiguous — it is both "no entry" and a legitimately cached
    // null. Treated as a miss on purpose: recomputing a null is cheap, and
    // caching "this product does not exist" is how a newly added product stays
    // invisible for an hour.
    if (hit !== null && hit !== undefined) return hit;
  } catch (error) {
    console.error("[cache] read failed, falling through", { full, error });
    return compute();
  }

  const pending = inFlight.get(full);
  if (pending) return pending as Promise<T>;

  const work = (async () => {
    const value = await compute();
    try {
      if (value !== null && value !== undefined) {
        await r.set(full, value, { ex: ttl });
      }
    } catch (error) {
      // A value that could not be stored is still a value that can be returned.
      console.error("[cache] write failed", { full, error });
    }
    return value;
  })().finally(() => inFlight.delete(full));

  inFlight.set(full, work);
  return work;
}

/**
 * A stable key for a function and its arguments.
 *
 * `JSON.stringify` on the arguments makes the key depend on property ORDER for
 * objects, so callers pass plain, consistently-built values. Long keys are
 * hashed to keep them under Redis's limits and out of the logs.
 */
export function cacheKey(name: string, args: unknown): string {
  const encoded = JSON.stringify(args ?? null);
  if (encoded.length <= 200) return `${name}:${encoded}`;

  let hash = 0;
  for (let i = 0; i < encoded.length; i++) {
    hash = (hash * 31 + encoded.charCodeAt(i)) | 0;
  }
  return `${name}:h${(hash >>> 0).toString(36)}`;
}

/** True when Redis is configured — used by the health check. */
export function cacheConfigured(): boolean {
  return redis() !== null;
}

/** Round-trip check for a health endpoint or a deploy smoke test. */
export async function cachePing(): Promise<boolean> {
  const r = redis();
  if (!r) return false;
  try {
    await r.ping();
    return true;
  } catch {
    return false;
  }
}
