-- A class whose booking "opens" at or after its start can never be booked
-- (Zumba on 22. 10. had „Rezervace otevřít od“ set to its own 18:00 start).
-- Upcoming ones go back to the usual booking window.
UPDATE "class_sessions" SET "booking_opens_at" = NULL
WHERE "booking_opens_at" IS NOT NULL AND "booking_opens_at" >= "starts_at" AND "starts_at" > now();
