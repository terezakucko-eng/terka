-- VS 1121 je doplatek 100 Kč za Reformer fusion 8. 11. Když se objednávka potvrdila, systém usoudil, že doplatek
-- rezervace už není potřeba, a těch 100 Kč připsal klientce jako kredit – omylem: na lekci je a doplácí 100 Kč.
-- U rezervace je teď doplatek zaplacený tímhle převodem, kredit mizí. Jen když ta rezervace platí (není zrušená)
-- a kredit se od té doby nehnul.
WITH "o" AS (
  SELECT o."id", o."booking_id", o."amount", o."paid_at" FROM "orders" o JOIN "bookings" b ON b."id" = o."booking_id"
  WHERE o."number" = 1121 AND o."kind"::text = 'surcharge' AND o."status"::text = 'paid'
    AND b."status"::text IN ('confirmed', 'attended', 'no_show') AND b."method"::text IN ('membership', 'pass')
), "settled" AS (
  UPDATE "bookings" b SET
    "surcharge" = CASE WHEN b."surcharge" = 0 THEN "o"."amount" ELSE b."surcharge" END,
    "surcharge_paid_at" = coalesce(b."surcharge_paid_at", "o"."paid_at")
  FROM "o" WHERE b."id" = "o"."booking_id"
  RETURNING b."id"
), "t" AS (
  SELECT ct."id", ct."user_id", ct."delta"
  FROM "credit_transactions" ct JOIN "o" ON "o"."id" = ct."order_id"
  JOIN "users" u ON u."id" = ct."user_id"
  WHERE ct."reason"::text = 'refund' AND ct."delta" > 0 AND u."credit_balance" >= ct."delta"
    AND NOT EXISTS (SELECT 1 FROM "credit_transactions" l WHERE l."user_id" = ct."user_id" AND l."created_at" > ct."created_at")
), "gone" AS (
  DELETE FROM "credit_transactions" ct USING "t" WHERE ct."id" = "t"."id"
  RETURNING ct."user_id", ct."delta"
)
UPDATE "users" u SET "credit_balance" = u."credit_balance" - "gone"."delta"
FROM "gone" WHERE u."id" = "gone"."user_id";--> statement-breakpoint
-- …a z pořadníku dostane místo na Reformer fusion v neděli 15. 11. v 17:00 – jako „Přidat klienta“ v adminu: přes
-- členství, s doplatkem pro členy (z kreditu, jen když na něj má). Jen když je na lekci místo a členství na ni platí.
WITH "cli" AS (
  SELECT u."id", u."credit_balance", u."credit_expires_at"
  FROM "orders" o JOIN "users" u ON u."id" = o."user_id"
  WHERE o."number" = 1121 AND o."kind"::text = 'surcharge'
), "ses" AS (
  SELECT s."id", s."capacity", s."class_type_id", s."starts_at",
    -- the members' surcharge on the lesson's day (as on the price list)
    CASE
      WHEN ct."member_surcharge_next" IS NOT NULL AND ct."member_surcharge_next_from" IS NOT NULL AND d."day" >= ct."member_surcharge_next_from" THEN ct."member_surcharge_next"
      WHEN coalesce(ct."member_surcharge", 0) = 0 THEN 0
      WHEN ct."member_surcharge_from" IS NOT NULL AND d."day" < ct."member_surcharge_from" THEN 0
      ELSE ct."member_surcharge"
    END AS "surcharge"
  FROM "class_sessions" s JOIN "class_types" ct ON ct."id" = s."class_type_id"
  CROSS JOIN LATERAL (SELECT to_char(s."starts_at" AT TIME ZONE 'Europe/Prague', 'YYYY-MM-DD') AS "day") d
  WHERE s."id" = 'dae12072-7e55-47d1-854b-ebd8d7edb3d9' AND s."status"::text = 'scheduled' AND s."starts_at" > now()
), "ent" AS (
  SELECT e."id"
  FROM "entitlements" e CROSS JOIN "cli" CROSS JOIN "ses"
  WHERE e."user_id" = "cli"."id" AND e."kind"::text = 'membership' AND e."status"::text = 'active'
    AND e."valid_from" <= "ses"."starts_at" AND e."valid_until" > "ses"."starts_at"
    AND (e."class_type_id" IS NULL OR e."class_type_id" = "ses"."class_type_id")
    AND e."weekly_limit" IS NULL AND e."before_hour" IS NULL AND NOT e."same_day_only"
    -- lessons of this class included in the membership change the surcharge – that's left to the app
    AND NOT (coalesce(e."included_class_type_id" = "ses"."class_type_id", false) AND e."included_per_month" > 0)
  ORDER BY e."valid_until" DESC
  LIMIT 1
), "take" AS (
  SELECT "cli"."id" AS "user_id", "ses"."id" AS "session_id", "ent"."id" AS "ent_id", w."id" AS "waitlist_id",
    "ses"."surcharge", round("ses"."surcharge" / 100.0)::int AS "credits",
    "ses"."surcharge" > 0 AND ("cli"."credit_expires_at" IS NULL OR "cli"."credit_expires_at" > now())
      AND "cli"."credit_balance" >= round("ses"."surcharge" / 100.0) AS "pay"
  FROM "cli" CROSS JOIN "ses" CROSS JOIN "ent"
  LEFT JOIN "bookings" w ON w."user_id" = "cli"."id" AND w."session_id" = "ses"."id" AND w."status"::text = 'waitlist'
  WHERE coalesce(w."seats", 1) = 1
    AND NOT EXISTS (SELECT 1 FROM "bookings" b WHERE b."user_id" = "cli"."id" AND b."session_id" = "ses"."id" AND b."status"::text NOT IN ('cancelled', 'waitlist'))
    AND (SELECT coalesce(sum(b."seats"), 0) FROM "bookings" b
         WHERE b."session_id" = "ses"."id" AND b."status"::text IN ('pending_payment', 'confirmed', 'attended', 'no_show')) + 1 <= "ses"."capacity"
), "promoted" AS (
  UPDATE "bookings" b SET "status" = 'confirmed', "method" = 'membership', "entitlement_id" = "take"."ent_id",
    "credits_charged" = 0, "entries_charged" = 0, "surcharge" = "take"."surcharge",
    "surcharge_paid_at" = CASE WHEN "take"."pay" THEN now() END
  FROM "take" WHERE b."id" = "take"."waitlist_id"
  RETURNING b."id", b."user_id"
), "booked" AS (
  INSERT INTO "bookings" ("user_id", "session_id", "status", "method", "entitlement_id", "surcharge", "surcharge_paid_at")
  SELECT "take"."user_id", "take"."session_id", 'confirmed', 'membership', "take"."ent_id", "take"."surcharge", CASE WHEN "take"."pay" THEN now() END
  FROM "take" WHERE "take"."waitlist_id" IS NULL
  RETURNING "id", "user_id"
), "bk" AS (
  SELECT * FROM "promoted" UNION ALL SELECT * FROM "booked"
), "charged" AS (
  UPDATE "users" u SET "credit_balance" = u."credit_balance" - "take"."credits"
  FROM "take" WHERE u."id" = "take"."user_id" AND "take"."pay" AND EXISTS (SELECT 1 FROM "bk")
  RETURNING u."id", u."credit_balance"
)
INSERT INTO "credit_transactions" ("user_id", "delta", "balance_after", "reason", "booking_id", "note")
SELECT "charged"."id", -"take"."credits", "charged"."credit_balance", 'booking', "bk"."id",
  'Doplatek ' || ("take"."surcharge" / 100) || chr(160) || 'Kč zaplacen z kreditu'
FROM "charged" JOIN "take" ON "take"."user_id" = "charged"."id" JOIN "bk" ON "bk"."user_id" = "charged"."id";
