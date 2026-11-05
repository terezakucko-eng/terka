ALTER TABLE "class_types" ADD COLUMN "pass_card_entry" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- The free lesson from a Pošli to dál card counts on Reformer too (the welcome lesson still doesn't).
UPDATE "class_types" SET "pass_card_entry" = true WHERE "name" ILIKE '%reformer%';
