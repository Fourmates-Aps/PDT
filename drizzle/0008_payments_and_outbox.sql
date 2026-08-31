CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('requires_payment', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"recipient" text NOT NULL,
	"locale" text DEFAULT 'da' NOT NULL,
	"subject" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"attempts" numeric(4, 0) DEFAULT '0' NOT NULL,
	"last_error" text,
	"claimed_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"provider_ref" text NOT NULL,
	"status" "payment_status" DEFAULT 'requires_payment' NOT NULL,
	"amount_dkk" numeric(10, 2) NOT NULL,
	"amount_minor" numeric(12, 0) NOT NULL,
	"currency" text DEFAULT 'dkk' NOT NULL,
	"method_detail" text,
	"failure_reason" text,
	"captured_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stripe_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_outbox_pending_idx" ON "notification_outbox" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_ref_key" ON "payments" USING btree ("provider","provider_ref");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "stripe_events_received_idx" ON "stripe_events" USING btree ("received_at");