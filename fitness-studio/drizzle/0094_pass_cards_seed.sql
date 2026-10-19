-- Pošli to dál: the first four cards. Their codes are drawn here at random, so they never appear in the repository;
-- the admin prints them from Kartičky. Nothing happens if the cards already exist.
INSERT INTO "pass_cards" ("code", "label")
SELECT upper(substr(md5(random()::text || clock_timestamp()::text || g::text), 1, 6)), 'Kartička ' || g
FROM generate_series(1, 4) AS g
WHERE NOT EXISTS (SELECT 1 FROM "pass_cards");
