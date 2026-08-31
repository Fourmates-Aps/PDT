CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_url" text NOT NULL,
	"storage_path" text,
	"public_url" text,
	"content_type" text,
	"bytes" integer,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"mirrored_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_source_url_key" ON "media_assets" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "media_assets_pending_idx" ON "media_assets" USING btree ("mirrored_at","attempts");