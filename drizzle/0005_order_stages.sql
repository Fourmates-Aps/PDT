/*
 * Order stages: the D-3 migration.
 *
 * Replaces the enum the production board and pack-and-ship were built on
 * (approved · in_production · packing · shipped) with the four stages decided
 * in docs/PRODUCT-WORKFLOW-SPEC.md §0 D-3, plus the non-happy-path states
 * confirmed by Q-C3, and adds the dispatch timestamp Q-C2 (c) requires.
 *
 * Postgres cannot remove a value from an enum in place, so the column goes via
 * text. THE MAPPING HAPPENS WHILE IT IS TEXT — casting straight back would fail
 * on every existing row, because none of the old values survive.
 */
ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."order_status";--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_approval', 'booked', 'arrived_at_warehouse', 'sent_to_print', 'delivered', 'cancelled', 'rejected', 'refunded');--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "dispatched_at" timestamp with time zone;--> statement-breakpoint

/*
 * Dispatch first, while `shipped` still exists to read.
 *
 * The old enum recorded that a parcel had left but not when, so the best
 * evidence available is the row's last update — which, for an order that never
 * moved again after being shipped, is the dispatch itself. Only rows that
 * actually carry a parcel number are stamped: a `shipped` row without one was
 * never really dispatched.
 */
UPDATE "orders"
   SET "dispatched_at" = "updated_at"
 WHERE "status" IN ('shipped', 'delivered')
   AND "gls_parcel_number" IS NOT NULL;--> statement-breakpoint

/*
 * Stage mapping.
 *
 * `packing` and `shipped` have no equivalent, so they resolve by whether the
 * order carries decoration: a decorated order has been through print, an
 * undecorated one never goes there. Getting this wrong would put orders in a
 * column the warehouse cannot move them out of.
 */
UPDATE "orders" SET "status" = 'pending_approval' WHERE "status" = 'draft';--> statement-breakpoint
UPDATE "orders" SET "status" = 'booked' WHERE "status" = 'approved';--> statement-breakpoint
UPDATE "orders" SET "status" = 'sent_to_print' WHERE "status" = 'in_production';--> statement-breakpoint
UPDATE "orders" o
   SET "status" = CASE
     WHEN EXISTS (
       SELECT 1 FROM "order_lines" l
        WHERE l."order_id" = o."id" AND l."logo_placement" IS NOT NULL
     ) THEN 'sent_to_print'
     ELSE 'arrived_at_warehouse'
   END
 WHERE o."status" IN ('packing', 'shipped');--> statement-breakpoint

/* Anything left is already a value the new enum knows. */
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending_approval'::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";
