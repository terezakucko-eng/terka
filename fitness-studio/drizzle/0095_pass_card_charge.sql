ALTER TABLE "entitlements" ADD COLUMN "pair" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pass_card_uses" ADD COLUMN "entitlement_id" uuid;--> statement-breakpoint
ALTER TABLE "pass_card_uses" ADD COLUMN "registered_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pass_card_uses" ADD COLUMN "booked_notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pass_card_uses" ADD COLUMN "recharged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pass_cards" ADD COLUMN "charged" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "pass_card_uses" ADD CONSTRAINT "pass_card_uses_entitlement_id_entitlements_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."entitlements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- uses from before the cards could be charged (only test sign-ups) count as done – no late notices for them
UPDATE "pass_card_uses" SET "registered_notified_at" = "created_at", "booked_notified_at" = "created_at", "recharged_at" = "created_at" WHERE "recharged_at" IS NULL;
