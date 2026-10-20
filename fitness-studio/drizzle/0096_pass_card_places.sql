ALTER TABLE "pass_cards" ADD COLUMN "places_left" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
-- an emptied card (only test sign-ups so far) waits for its lessons like before
UPDATE "pass_cards" SET "places_left" = 0 WHERE "charged" = false;--> statement-breakpoint
ALTER TABLE "entitlements" DROP COLUMN "pair";
