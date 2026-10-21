ALTER TABLE "pass_cards" ADD COLUMN "valid_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pass_cards" ADD COLUMN "expired_notified_at" timestamp with time zone;