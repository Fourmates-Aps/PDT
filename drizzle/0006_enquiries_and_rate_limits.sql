CREATE TYPE "public"."application_status" AS ENUM('new', 'in_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."enquiry_kind" AS ENUM('contact', 'callback', 'newsletter');--> statement-breakpoint
CREATE TABLE "b2b_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company" text NOT NULL,
	"cvr" text NOT NULL,
	"ean" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"address" text NOT NULL,
	"zipcode" text NOT NULL,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"newsletter" boolean DEFAULT false NOT NULL,
	"locale" text DEFAULT 'da' NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"status" "application_status" DEFAULT 'new' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"organisation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "b2b_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "enquiry_kind" NOT NULL,
	"company" text,
	"name" text,
	"email" text,
	"phone" text,
	"address" text,
	"zipcode" text,
	"city" text,
	"country" text,
	"subject" text,
	"department" text,
	"message" text,
	"newsletter" boolean DEFAULT false NOT NULL,
	"locale" text DEFAULT 'da' NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"handled_at" timestamp with time zone,
	"handled_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "enquiries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"bucket" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "b2b_applications" ADD CONSTRAINT "b2b_applications_reviewed_by_organisation_members_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."organisation_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "b2b_applications" ADD CONSTRAINT "b2b_applications_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_handled_by_organisation_members_id_fk" FOREIGN KEY ("handled_by") REFERENCES "public"."organisation_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "b2b_applications_status_idx" ON "b2b_applications" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "b2b_applications_email_idx" ON "b2b_applications" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "b2b_applications_one_open_per_cvr" ON "b2b_applications" USING btree ("cvr") WHERE status in ('new', 'in_review');--> statement-breakpoint
CREATE INDEX "enquiries_kind_created_idx" ON "enquiries" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "enquiries_unhandled_idx" ON "enquiries" USING btree ("created_at") WHERE handled_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "enquiries_one_newsletter_per_email" ON "enquiries" USING btree ("email") WHERE kind = 'newsletter';--> statement-breakpoint
CREATE INDEX "rate_limits_window_idx" ON "rate_limits" USING btree ("window_start");