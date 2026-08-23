-- Adding a NOT NULL column to a populated table fails, so this is done in three
-- steps: add it nullable, backfill a slug derived from the existing name, then
-- apply the constraint. drizzle-kit generates the single-statement version,
-- which errors on any database that already has products.

ALTER TABLE "products" ADD COLUMN "slug" text;--> statement-breakpoint

UPDATE "products"
SET "slug" = regexp_replace(
      lower(
        translate("name" || '-' || "supplier_sku",
                  'æøåäöüéèêáàâíìîóòôúùûñ',
                  'aoaaouee eaaaiii oooouuun')
      ),
      '[^a-z0-9]+', '-', 'g'
    )
WHERE "slug" IS NULL;--> statement-breakpoint

UPDATE "products" SET "slug" = trim(both '-' from "slug");--> statement-breakpoint

ALTER TABLE "products" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint

CREATE UNIQUE INDEX "products_slug_key" ON "products" USING btree ("slug");
