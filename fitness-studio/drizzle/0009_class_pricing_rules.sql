ALTER TABLE "bookings" ADD COLUMN "surcharge" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "surcharge_paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "class_types" ADD COLUMN "member_surcharge" integer;--> statement-breakpoint
ALTER TABLE "class_types" ADD COLUMN "member_surcharge_from" text;--> statement-breakpoint
ALTER TABLE "class_types" ADD COLUMN "no_free_entry" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "class_types" ADD COLUMN "first_visit_price" integer;