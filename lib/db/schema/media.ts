import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Supplier images copied into our own storage.
 *
 * WHY MIRROR AT ALL. Every product image today is hotlinked straight from the
 * supplier's CDN — you.dk/static/... for the whole You range. That makes the
 * catalogue's appearance depend on somebody else's uptime and somebody else's
 * willingness to serve us: hotlink protection can be switched on without
 * warning, a URL can be reissued, and either way the shop renders empty frames
 * for products it is trying to sell.
 *
 * WHY A TABLE AND NOT A COLUMN. The same photograph is shared by every variant
 * of a style — 292 variants of one t-shirt point at two files. Keying on the
 * SOURCE URL means each file is fetched and stored once no matter how many rows
 * reference it, and re-running the mirror is free for anything already done.
 *
 * WHY NOT REWRITE products.primary_image. The feed is the authority on that
 * column and every import would overwrite whatever we put there. Keeping the
 * mapping separate means mirroring and importing cannot fight: the importer
 * writes supplier URLs, the mirror writes ours, and reads prefer ours when it
 * exists.
 */
export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The supplier URL as it appears in the feed. The join key. */
    sourceUrl: text("source_url").notNull(),
    /** Path inside the storage bucket. Null until a fetch succeeds. */
    storagePath: text("storage_path"),
    /** Fully-qualified URL to serve. Null until mirrored. */
    publicUrl: text("public_url"),
    contentType: text("content_type"),
    bytes: integer("bytes"),
    /**
     * Attempts so far, so a permanently dead URL stops being retried every
     * night. A supplier's 404 is not going to fix itself.
     */
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    mirroredAt: timestamp("mirrored_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("media_assets_source_url_key").on(t.sourceUrl),
    // The mirror run's own working query: what still needs fetching.
    index("media_assets_pending_idx").on(t.mirroredAt, t.attempts),
  ],
).enableRLS();
