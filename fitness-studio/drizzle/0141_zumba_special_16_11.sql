-- Monday 16 Nov 2026: a Zumba SPECIAL evening with the guest instructors Marek and Martin from Olomouc (and Tereza).
-- 18:00 – the regular Zumba fitness that evening becomes „Zumba fitness SPECIAL“, its bookings stay; if it isn't
--         in the schedule (any more), it's added.
-- 17:00 – a new „Zumba Toning SPECIAL“: length, places and price like the Toning on Tue 17 Nov (the lesson's own
--         when that one is gone), its instructor and room. Booking by the usual window. Each only once.
UPDATE "class_sessions" s
SET "title" = 'Zumba fitness SPECIAL',
    "note" = 'Speciální lekce s hostujícími lektory Markem a Martinem z Olomouce – a samozřejmě s Terezou.'
FROM "class_types" ct
WHERE ct."id" = s."class_type_id" AND ct."slug" = 'zumba-fitness'
  AND s."starts_at" = '2026-11-16 18:00:00+01' AND s."status"::text <> 'cancelled'
  AND coalesce(trim(s."title"), '') = '';
--> statement-breakpoint
INSERT INTO "class_sessions" ("class_type_id", "instructor_id", "starts_at", "duration_min", "capacity", "credit_cost", "drop_in_price", "room", "title", "note")
SELECT ct."id", s."instructor_id", '2026-11-16 18:00:00+01', coalesce(s."duration_min", ct."duration_min"), coalesce(s."capacity", ct."capacity"),
  coalesce(s."credit_cost", ct."credit_cost"), coalesce(s."drop_in_price", ct."drop_in_price"), s."room", 'Zumba fitness SPECIAL',
  'Speciální lekce s hostujícími lektory Markem a Martinem z Olomouce – a samozřejmě s Terezou.'
FROM (SELECT * FROM "class_types" WHERE "slug" = 'zumba-fitness' AND "is_active" AND "archived_at" IS NULL LIMIT 1) ct
LEFT JOIN "class_sessions" s ON s."id" = '793a745c-cc1b-4c4d-aed6-47f0a7b9895f'
WHERE NOT EXISTS (
  SELECT 1 FROM "class_sessions" y
  WHERE y."class_type_id" = ct."id" AND y."starts_at" = '2026-11-16 18:00:00+01' AND y."status"::text <> 'cancelled'
);
--> statement-breakpoint
INSERT INTO "class_sessions" ("class_type_id", "instructor_id", "starts_at", "duration_min", "capacity", "credit_cost", "drop_in_price", "room", "title", "note")
SELECT ct."id", s."instructor_id", '2026-11-16 17:00:00+01', coalesce(s."duration_min", ct."duration_min"), coalesce(s."capacity", ct."capacity"),
  coalesce(s."credit_cost", ct."credit_cost"), coalesce(s."drop_in_price", ct."drop_in_price"), s."room", 'Zumba Toning SPECIAL',
  'Speciální lekce s hostujícími lektory Markem a Martinem z Olomouce – a samozřejmě s Terezou.'
FROM (SELECT * FROM "class_types" WHERE "slug" = 'zumba-toning' AND "is_active" AND "archived_at" IS NULL LIMIT 1) ct
LEFT JOIN "class_sessions" s ON s."id" = '045d5233-b402-4007-a5f1-bcb5eb1fb223'
WHERE NOT EXISTS (
  SELECT 1 FROM "class_sessions" y
  WHERE y."class_type_id" = ct."id" AND y."starts_at" = '2026-11-16 17:00:00+01' AND y."status"::text <> 'cancelled'
);
