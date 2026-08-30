CREATE TYPE "public"."import_change_type" AS ENUM('created', 'updated', 'discontinued', 'unchanged');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('running', 'staged', 'publishing', 'published', 'failed', 'rejected');--> statement-breakpoint
CREATE TABLE "import_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"change_type" "import_change_type" NOT NULL,
	"supplier_sku" text NOT NULL,
	"product_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"summary" text
);
--> statement-breakpoint
ALTER TABLE "import_changes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" text NOT NULL,
	"status" "import_status" DEFAULT 'running' NOT NULL,
	"source" text NOT NULL,
	"created" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"discontinued" integer DEFAULT 0 NOT NULL,
	"unchanged" integer DEFAULT 0 NOT NULL,
	"skipped" jsonb,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"staged_at" timestamp with time zone,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "import_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "import_changes" ADD CONSTRAINT "import_changes_run_id_import_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."import_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_changes" ADD CONSTRAINT "import_changes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_decided_by_organisation_members_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."organisation_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_changes_run_idx" ON "import_changes" USING btree ("run_id","change_type");--> statement-breakpoint
CREATE INDEX "import_changes_sku_idx" ON "import_changes" USING btree ("supplier_sku");--> statement-breakpoint
CREATE INDEX "import_runs_supplier_idx" ON "import_runs" USING btree ("supplier_id","started_at");