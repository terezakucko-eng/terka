-- Barre + Brunch v sobotu 23. 1. 2027, 8:30–11:00 (přání studia 23. 11. 2026): jako ten 12. 12. 2026 – lekce, lektorka,
-- místa, cena, sál a název; rezervace otevřené hned. Jen jednou, a ne když v tu dobu už nějaký brunch je.
-- Na čerstvé databázi (bez prosincového brunche) vezme výchozí hodnoty lekce.
INSERT INTO "class_sessions" ("class_type_id", "instructor_id", "starts_at", "duration_min", "capacity", "credit_cost", "drop_in_price", "is_free", "room", "title", "booking_opens_at")
SELECT ct."id", s."instructor_id", '2027-01-23 08:30:00+01', COALESCE(s."duration_min", 150),
  COALESCE(s."capacity", ct."capacity"), COALESCE(s."credit_cost", ct."credit_cost"),
  CASE WHEN s."id" IS NULL THEN ct."drop_in_price" ELSE s."drop_in_price" END,
  COALESCE(s."is_free", false), s."room", COALESCE(s."title", 'Barre + Brunch'), '2026-11-23 00:00:00+01'
FROM "class_types" ct
LEFT JOIN "class_sessions" s ON s."id" = '2177a6d2-da80-4666-8b55-4be59c4d0bcf'
WHERE ct."slug" = 'fitness-brunch'
  AND NOT EXISTS (
    SELECT 1 FROM "class_sessions" y
    WHERE y."class_type_id" = ct."id" AND y."starts_at" = '2027-01-23 08:30:00+01' AND y."status"::text <> 'cancelled'
  );
--> statement-breakpoint
-- Běžná sobotní Barre v 8:30 ten den odpadá (cvičí se na brunchi) – jen když na ní nikdo není. Kde už někdo je,
-- zůstává: zrušit ji musí studio v administraci (vrátí vstupy a pošle e-mail).
UPDATE "class_sessions" s SET "status" = 'cancelled'
FROM "class_types" ct
WHERE ct."id" = s."class_type_id" AND ct."slug" = 'barre' AND s."starts_at" = '2027-01-23 08:30:00+01' AND s."status"::text = 'scheduled'
  AND coalesce(s."title", '') = ''
  AND NOT EXISTS (SELECT 1 FROM "bookings" b WHERE b."session_id" = s."id" AND b."status"::text <> 'cancelled')
  AND EXISTS (
    SELECT 1 FROM "class_sessions" y JOIN "class_types" t ON t."id" = y."class_type_id"
    WHERE t."slug" = 'fitness-brunch' AND y."starts_at" = '2027-01-23 08:30:00+01' AND y."status"::text = 'scheduled'
  );
