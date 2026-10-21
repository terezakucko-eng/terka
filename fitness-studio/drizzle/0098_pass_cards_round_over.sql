-- Pošli to dál: a card no longer waits for the lessons – a full round is over at once.
-- Cards left empty while waiting get both places back (old code never reads these tables).
UPDATE "pass_card_uses" SET "recharged_at" = now()
WHERE "recharged_at" IS NULL AND "card_id" IN (SELECT "id" FROM "pass_cards" WHERE "places_left" = 0);
--> statement-breakpoint
UPDATE "pass_cards" SET "places_left" = 2 WHERE "places_left" = 0;
