ALTER TABLE "entitlements" ADD COLUMN "expiry_warned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "last_call_at" timestamp with time zone;