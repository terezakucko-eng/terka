-- Barre + Brunch again: Saturday 12 Dec 2026, 9:30–11:00. Like the first one on 31 Oct (the lesson, instructor,
-- places, price and room; not its note), and booking is open right away. Only once – not if a brunch already
-- starts then; without the first one (a fresh database) it takes the lesson's defaults.
INSERT INTO "class_sessions" ("class_type_id", "instructor_id", "starts_at", "duration_min", "capacity", "credit_cost", "drop_in_price", "is_free", "room", "title", "booking_opens_at")
SELECT ct."id", s."instructor_id", '2026-12-12 09:30:00+01', 90,
  COALESCE(s."capacity", ct."capacity"),
  COALESCE(s."credit_cost", ct."credit_cost"),
  CASE WHEN s."id" IS NULL THEN ct."drop_in_price" ELSE s."drop_in_price" END,
  COALESCE(s."is_free", false),
  s."room",
  COALESCE(s."title", 'Barre + Brunch'),
  '2026-10-31 00:00:00+01'
FROM "class_types" ct
LEFT JOIN "class_sessions" s ON s."id" = '3f3a2507-1b0e-48c3-a9d8-d7d0afc7a21c'
WHERE ct."slug" = 'fitness-brunch'
  AND NOT EXISTS (
    SELECT 1 FROM "class_sessions" y
    WHERE y."class_type_id" = ct."id" AND y."starts_at" = '2026-12-12 09:30:00+01' AND y."status"::text <> 'cancelled'
  );
