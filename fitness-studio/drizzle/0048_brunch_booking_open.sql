-- Booking for the first brunch (Sat 31 Oct 2026, Barre + Brunch) opens right away instead of on 19 Oct.
UPDATE "class_sessions" SET "booking_opens_at" = '2026-10-10 00:00:00+02'
WHERE "id" = '3f3a2507-1b0e-48c3-a9d8-d7d0afc7a21c' AND "booking_opens_at" IS NULL;
