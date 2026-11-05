-- Monday 16 Nov 2026: no Zdravé tělo | silový trénink at 17:00 – the Zumba SPECIAL with the guests from Olomouc is on.
-- Cancelled here only while nobody is signed up (not even on the waitlist); with clients it's cancelled by the studio
-- in the admin, which gives back what they paid and lets them know.
UPDATE "class_sessions" s
SET "status" = 'cancelled'
WHERE s."id" = 'c1c6feac-3d31-4de9-94c7-d6d9d9cf319e'
  AND s."starts_at" = '2026-11-16 17:00:00+01' AND s."status"::text = 'scheduled'
  AND NOT EXISTS (
    SELECT 1 FROM "bookings" b WHERE b."session_id" = s."id" AND b."status"::text <> 'cancelled'
  );
