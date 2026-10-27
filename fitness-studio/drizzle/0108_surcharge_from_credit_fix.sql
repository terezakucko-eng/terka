-- A surcharge waiting for a transfer (VS 1113) whose client bought credit to pay surcharges with:
-- paid from that credit now, as the new "Z kreditu" button does – 1 Kč = 1 kredit, the transfer is
-- called off, the credit history shows it. Only while still unpaid and the (valid) credit covers it.
WITH "target" AS (
  SELECT b."id" AS "booking_id", b."user_id", b."surcharge", round(b."surcharge" / 100.0)::int AS "credits"
  FROM "orders" o
  JOIN "bookings" b ON b."id" = o."booking_id"
  JOIN "users" u ON u."id" = b."user_id"
  WHERE o."number" = 1113
    AND o."kind"::text = 'surcharge'
    AND o."status"::text = 'pending'
    AND b."surcharge" > 0
    AND b."surcharge_paid_at" IS NULL
    AND b."status"::text IN ('confirmed', 'attended', 'no_show')
    AND NOT EXISTS (
      SELECT 1 FROM "orders" p
      WHERE p."booking_id" = b."id" AND p."kind"::text = 'surcharge' AND p."status"::text = 'paid'
    )
    AND u."credit_balance" >= round(b."surcharge" / 100.0)
    AND (u."credit_expires_at" IS NULL OR u."credit_expires_at" > now())
),
"paid" AS (
  UPDATE "bookings" b SET "surcharge_paid_at" = now()
  FROM "target" t
  WHERE b."id" = t."booking_id"
  RETURNING b."id"
),
"called_off" AS (
  UPDATE "orders" o SET "status" = 'cancelled'
  FROM "target" t
  WHERE o."booking_id" = t."booking_id" AND o."kind"::text = 'surcharge' AND o."status"::text = 'pending'
  RETURNING o."id"
),
"debited" AS (
  UPDATE "users" u SET "credit_balance" = u."credit_balance" - t."credits"
  FROM "target" t
  WHERE u."id" = t."user_id"
  RETURNING u."id", u."credit_balance"
)
INSERT INTO "credit_transactions" ("user_id", "delta", "balance_after", "reason", "booking_id", "note")
SELECT t."user_id", -t."credits", d."credit_balance", 'booking', t."booking_id",
  'Doplatek ' || round(t."surcharge" / 100.0)::int || ' Kč zaplacen z kreditu'
FROM "target" t
JOIN "debited" d ON d."id" = t."user_id";
