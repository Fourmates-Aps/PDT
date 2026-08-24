CREATE TYPE "public"."supplier_channel" AS ENUM('api', 'graphql', 'edi', 'ftp', 'sftp', 'portal', 'csv', 'email');--> statement-breakpoint
CREATE TYPE "public"."supplier_order_status" AS ENUM('accumulating', 'ready', 'released', 'confirmed', 'received', 'cancelled');--> statement-breakpoint
CREATE TABLE "supplier_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_order_id" uuid NOT NULL,
	"product_variant_id" uuid NOT NULL,
	"order_line_id" uuid,
	"quantity" integer NOT NULL,
	"unit_cost_dkk" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_order_lines_quantity_positive" CHECK ("supplier_order_lines"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "supplier_order_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "supplier_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"status" "supplier_order_status" DEFAULT 'accumulating' NOT NULL,
	"reference" text,
	"released_at" timestamp with time zone,
	"released_by" uuid,
	"received_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplier_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"product_group" text,
	"order_channel" "supplier_channel" DEFAULT 'email' NOT NULL,
	"data_channel" text,
	"minimum_order_qty" integer DEFAULT 0 NOT NULL,
	"minimum_order_value_dkk" numeric(12, 2) DEFAULT '0' NOT NULL,
	"lead_time_days" integer DEFAULT 5 NOT NULL,
	"contact_email" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "supplier_order_lines" ADD CONSTRAINT "supplier_order_lines_supplier_order_id_supplier_orders_id_fk" FOREIGN KEY ("supplier_order_id") REFERENCES "public"."supplier_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_order_lines" ADD CONSTRAINT "supplier_order_lines_product_variant_id_product_variants_id_fk" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_order_lines" ADD CONSTRAINT "supplier_order_lines_order_line_id_order_lines_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_orders" ADD CONSTRAINT "supplier_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_orders" ADD CONSTRAINT "supplier_orders_released_by_users_id_fk" FOREIGN KEY ("released_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supplier_order_lines_order_idx" ON "supplier_order_lines" USING btree ("supplier_order_id");--> statement-breakpoint
CREATE INDEX "supplier_orders_supplier_status_idx" ON "supplier_orders" USING btree ("supplier_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_orders_one_open_per_supplier" ON "supplier_orders" USING btree ("supplier_id") WHERE status = 'accumulating';--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers" USING btree ("code");