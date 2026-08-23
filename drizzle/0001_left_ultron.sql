CREATE TYPE "public"."display_mode" AS ENUM('price', 'points');--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "display_mode" "display_mode" DEFAULT 'price' NOT NULL;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "default_allowance_dkk" numeric(10, 2) DEFAULT '1500' NOT NULL;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "order_approval_limit_dkk" numeric(10, 2) DEFAULT '1000' NOT NULL;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "allow_personal_purchases" boolean DEFAULT true NOT NULL;