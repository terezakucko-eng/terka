-- Monday 16 Nov 2026, 17:00: with the Zumba Toning SPECIAL off, the usual Monday Zdravé tělo | silový trénink is back
-- in the schedule (it was taken off for the SPECIAL). Set up like the next Monday's lesson – its instructor, room,
-- length, places and prices – and open for booking by the usual rules. Only while nothing else is scheduled then
-- (so a lesson the studio has put there by hand stays the only one). Fixed id – added once.
INSERT INTO "class_sessions" ("id", "class_type_id", "instructor_id", "starts_at", "duration_min", "capacity", "credit_cost", "drop_in_price", "is_free", "room")
SELECT 'e3b5a1d7-2c46-4f8a-b9d0-5a6c7e8f9012', t."class_type_id", t."instructor_id", '2026-11-16 17:00:00+01', t."duration_min", t."capacity", t."credit_cost", t."drop_in_price", t."is_free", t."room"
FROM "class_sessions" t
JOIN "class_types" ct ON ct."id" = t."class_type_id" AND ct."name" ILIKE '%silov%'
WHERE t."id" = (
    SELECT x."id" FROM "class_sessions" x
    WHERE x."id" IN ('14cbd914-b7f7-4386-9317-6332983bcdfc', '3c47164c-9414-49e7-85a3-d4b8767e1dfa', '9688c8e1-64c5-4995-b18d-6d7367856606')
    ORDER BY abs(extract(epoch FROM x."starts_at" - timestamptz '2026-11-16 17:00:00+01')), x."starts_at" DESC LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM "class_sessions" y WHERE y."starts_at" = '2026-11-16 17:00:00+01' AND y."status"::text = 'scheduled'
  )
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- The board post's line about the change says what's on at 17:00 instead (only while it's the line as it was written).
UPDATE "announcements" SET "body" = replace("body",
    'Zumba Toning v 17:00 se nakonec nekoná – omlouváme se. O to víc to společně rozjedeme v 18:00! 💃',
    'Zumba Toning v 17:00 se nakonec nekoná – omlouváme se. V 17:00 je místo něj jako každé pondělí <a href="/rozvrh/e3b5a1d7-2c46-4f8a-b9d0-5a6c7e8f9012">Zdravé tělo | silový trénink</a> a v 18:00 to společně rozjedeme na Zumbě! 💃')
WHERE "id" = '146aa9e2-80ab-437c-b082-47ecb7403616'
  AND "body" LIKE '%Zumba Toning v 17:00 se nakonec nekoná – omlouváme se. O to víc to společně rozjedeme v 18:00! 💃%'
  AND EXISTS (SELECT 1 FROM "class_sessions" s WHERE s."id" = 'e3b5a1d7-2c46-4f8a-b9d0-5a6c7e8f9012' AND s."status"::text = 'scheduled');
