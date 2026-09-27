ALTER TABLE "massage_bookings" ADD COLUMN "member_rate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "massage_services" ADD COLUMN "member_price" integer;