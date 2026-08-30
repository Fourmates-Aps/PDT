import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * A fixed-window rate limiter backed by Postgres.
 *
 * WHY POSTGRES AND NOT REDIS. There is no Redis in this project and no
 * credentials for one. The alternative usually reached for — a Map in module
 * scope — is not a rate limit: it empties on every deploy, and each instance
 * keeps its own copy, so the real ceiling is (limit x instances) and nobody can
 * say what it is. This table is shared by every instance and survives restarts.
 * If Redis ever arrives, only this file changes.
 *
 * WHY FIXED WINDOW. A sliding window needs a row per request; this needs one row
 * per bucket per window. The cost is a burst across a boundary — up to twice the
 * limit in one instant — which is fine for form spam and would NOT be fine for
 * anything metering money or sending SMS.
 *
 * The whole count is one statement, so two concurrent requests cannot both read
 * the same count and both decide they are under the limit.
 */

export type RateLimitRule = {
  /** Requests permitted per window. */
  max: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  ok: boolean;
  /** Requests left in this window; never negative. */
  remaining: number;
  /** When the window rolls over — sent as Retry-After. */
  resetAt: Date;
  retryAfterSeconds: number;
};

/**
 * The salt for IP hashes.
 *
 * An unsalted SHA-256 of an IPv4 address is reversible by brute force in
 * seconds — the whole space is 2^32 — so an unsalted hash is not anonymisation,
 * it just looks like it. Any of these secrets works; they are already required
 * for the app to boot at all.
 */
function salt(): string | null {
  return (
    process.env.RATE_LIMIT_SALT ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.DATABASE_URL ??
    null
  );
}

/**
 * A stable, non-reversible handle for a caller.
 *
 * Returns null when no secret is configured, and the caller then stores nothing.
 * A weak hash presented as anonymised data is worse than an honest blank.
 */
export function hashIp(ip: string | null): string | null {
  const secret = salt();
  if (!ip || !secret) return null;
  return createHash("sha256").update(`${secret}:${ip}`).digest("hex");
}

/**
 * The caller's address, as far as it can be trusted.
 *
 * `x-forwarded-for` is a client-supplied header — anything can send one. Behind
 * a proxy that overwrites it (Vercel, Cloudflare, most load balancers) the FIRST
 * entry is the real client; with no proxy in front, it can be forged outright.
 * That is acceptable here because this feeds a spam limit, not an access
 * decision. It must never be used for authorisation.
 */
export function callerIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? null;
}

/**
 * Count one hit against `bucket` and say whether it is allowed.
 *
 * Fails OPEN. If the database is unreachable the request is permitted rather
 * than rejected: a limiter that takes the whole public site down when Postgres
 * hiccups has caused a bigger outage than the spam it was guarding against. The
 * failure is logged so it cannot pass silently.
 */
export async function rateLimit(
  bucket: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const { max, windowSeconds } = rule;

  try {
    const rows = await db.execute<{ count: number; window_start: Date }>(sql`
      insert into rate_limits (bucket, window_start, count)
      values (
        ${bucket},
        to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}) * ${windowSeconds}),
        1
      )
      on conflict (bucket) do update set
        count = case
          when rate_limits.window_start = excluded.window_start
          then rate_limits.count + 1
          else 1
        end,
        window_start = excluded.window_start
      returning count, window_start
    `);

    const row = rows[0];
    if (!row) return allow(max, windowSeconds);

    const windowStart = new Date(row.window_start);
    const resetAt = new Date(windowStart.getTime() + windowSeconds * 1000);
    const count = Number(row.count);

    void prune();

    return {
      ok: count <= max,
      remaining: Math.max(0, max - count),
      resetAt,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((resetAt.getTime() - Date.now()) / 1000),
      ),
    };
  } catch (error) {
    console.error("[rate-limit] failed open", { bucket, error });
    return allow(max, windowSeconds);
  }
}

function allow(max: number, windowSeconds: number): RateLimitResult {
  const resetAt = new Date(Date.now() + windowSeconds * 1000);
  return { ok: true, remaining: max, resetAt, retryAfterSeconds: windowSeconds };
}

/**
 * Drop windows nobody can still be inside.
 *
 * Roughly one call in fifty, so the cost is amortised and no single request pays
 * for a scan. A cron job would be tidier; this needs no infrastructure.
 *
 * TODO(ops): move to a scheduled job if this table ever gets real traffic.
 */
async function prune(): Promise<void> {
  if (Math.random() > 0.02) return;
  try {
    await db.execute(
      sql`delete from rate_limits where window_start < now() - interval '1 day'`,
    );
  } catch {
    // Housekeeping. If it fails, the next request tries again.
  }
}

/**
 * The limits for the public forms.
 *
 * Applications are the tightest: a company applies once, and a second attempt
 * within the hour is a mistake or a script. The newsletter is looser per window
 * but pointless to spam — the table upserts on the address.
 */
export const ENQUIRY_LIMITS = {
  application: { max: 3, windowSeconds: 3600 },
  contact: { max: 5, windowSeconds: 600 },
  callback: { max: 5, windowSeconds: 600 },
  newsletter: { max: 5, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * A second ceiling that is not per-IP.
 *
 * One address behind a lot of addresses is the shape of a distributed flood, and
 * a per-IP limit cannot see it. Deliberately generous: this is a backstop, not
 * the main control.
 */
export const PER_EMAIL_LIMIT: RateLimitRule = { max: 5, windowSeconds: 3600 };
