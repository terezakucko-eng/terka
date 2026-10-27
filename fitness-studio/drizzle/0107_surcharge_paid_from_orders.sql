-- A surcharge paid by card / transfer (its order is paid) but the booking still says unpaid – e.g. the paid
-- badge tapped by mistake in the class detail, which un-marked it. The order is the truth: mark it paid again.
UPDATE "bookings" b
SET "surcharge_paid_at" = o."paid_at"
FROM "orders" o
WHERE o."booking_id" = b."id"
  AND o."kind"::text = 'surcharge'
  AND o."status"::text = 'paid'
  AND o."paid_at" IS NOT NULL
  AND b."surcharge" > 0
  AND b."surcharge_paid_at" IS NULL
  AND b."status"::text <> 'cancelled';
