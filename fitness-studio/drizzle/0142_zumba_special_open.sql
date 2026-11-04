-- The two Zumba SPECIALs on Monday 16 Nov 2026 open for booking to everyone now (not just members first) –
-- unless the studio has already set their opening by hand.
UPDATE "class_sessions" s
SET "booking_opens_at" = '2026-11-04 00:00:00+01'
FROM "class_types" ct
WHERE ct."id" = s."class_type_id" AND ct."slug" IN ('zumba-toning', 'zumba-fitness')
  AND s."starts_at" IN ('2026-11-16 17:00:00+01', '2026-11-16 18:00:00+01')
  AND s."title" LIKE '%SPECIAL' AND s."status"::text <> 'cancelled'
  AND s."booking_opens_at" IS NULL;
