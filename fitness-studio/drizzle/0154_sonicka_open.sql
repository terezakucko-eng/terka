-- „Zumba pro Soničku“ (Sun 6 Dec 2026 18:00) opens for booking to everyone now – the code that keeps it to card or
-- transfer only is live. Unless the studio has set the opening by hand meanwhile.
UPDATE "class_sessions"
SET "booking_opens_at" = '2026-11-11 23:15:00+01'
WHERE "id" = '9ed16f85-b076-4f4c-957f-10cb52da3726'
  AND "drop_in_only" = true
  AND "status"::text = 'scheduled'
  AND "booking_opens_at" IS NULL;
