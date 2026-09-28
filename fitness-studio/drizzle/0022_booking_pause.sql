ALTER TABLE "users" ADD COLUMN "booking_paused_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "strikes_reset_at" timestamp with time zone;