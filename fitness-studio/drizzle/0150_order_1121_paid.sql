-- Převod s VS 1121 (permanentka na Reformer) dorazil – potvrzujeme ho jako tlačítko „Zaplaceno“ v adminu:
-- objednávka je zaplacená a klientce se připíše permanentka (přesně jako při nákupu). Jen když 1121 je
-- opravdu nezaplacená objednávka permanentky; cokoli jiného zůstane, jak je.
WITH "paid" AS (
  UPDATE "orders" o SET "status" = 'paid', "paid_at" = now(),
    "provider" = CASE WHEN o."provider" = 'transfer' THEN 'transfer' ELSE 'manual' END
  FROM "products" p
  WHERE o."number" = 1121 AND o."kind"::text = 'product' AND o."status"::text IN ('pending', 'expired')
    AND p."id" = o."product_id" AND p."kind"::text = 'pass'
  RETURNING o."id", o."user_id", o."product_id"
)
INSERT INTO "entitlements" ("user_id", "kind", "product_id", "order_id", "name", "entries_total", "class_type_id", "valid_from", "valid_until")
SELECT "paid"."user_id", 'pass', p."id", "paid"."id", p."name", p."entries", p."class_type_id",
  greatest(now(), coalesce(p."sale_from", now())),
  greatest(now(), coalesce(p."sale_from", now())) + coalesce(p."validity_days", 30) * interval '24 hours'
FROM "paid" JOIN "products" p ON p."id" = "paid"."product_id"
WHERE NOT EXISTS (SELECT 1 FROM "entitlements" x WHERE x."order_id" = "paid"."id");--> statement-breakpoint
-- Kamarádka, která ji pozvala, dostane za její první platbu dárek – jako u každé zaplacené objednávky.
WITH "friend" AS (
  SELECT o."user_id", u."nickname", u."name"
  FROM "orders" o JOIN "users" u ON u."id" = o."user_id"
  WHERE o."number" = 1121 AND o."status"::text = 'paid' AND o."amount" > 0
    AND EXISTS (SELECT 1 FROM "entitlements" e WHERE e."order_id" = o."id")
), "cfg" AS (
  SELECT
    coalesce((SELECT ("value" #>> '{}')::numeric::int FROM "settings" WHERE "key" = 'referralGiftEntries' AND jsonb_typeof("value") = 'number'), 1) AS "entries",
    coalesce((SELECT ("value" #>> '{}')::numeric::int FROM "settings" WHERE "key" = 'referralGiftValidityDays' AND jsonb_typeof("value") = 'number'), 60) AS "days"
), "ref" AS (
  SELECT r."id", r."referrer_id", f."nickname", f."name"
  FROM "referrals" r JOIN "friend" f ON f."user_id" = r."friend_id"
  WHERE r."rewarded_at" IS NULL
), "gift" AS (
  INSERT INTO "entitlements" ("user_id", "kind", "name", "entries_total", "valid_from", "valid_until", "note")
  SELECT "ref"."referrer_id", 'free', 'Lekce zdarma za pozvání 💛', "cfg"."entries", now(), now() + greatest(1, "cfg"."days") * interval '24 hours',
    'Za pozvání kamarádky: ' || coalesce(nullif(trim("ref"."nickname"), ''), split_part("ref"."name", ' ', 1))
  FROM "ref" CROSS JOIN "cfg"
  WHERE "cfg"."entries" > 0
  RETURNING "id", "user_id"
)
UPDATE "referrals" r SET "rewarded_at" = now(), "reward_entitlement_id" = "gift"."id"
FROM "gift" JOIN "ref" ON "ref"."referrer_id" = "gift"."user_id"
WHERE r."id" = "ref"."id";--> statement-breakpoint
-- …a z pořadníku dostane místo na Reformer fusion v neděli 15. 11. v 17:00 – strhne se z té permanentky.
-- Jen když je na lekci místo a permanentka na ni platí; kdyby v pořadníku nebyla, přihlásí se nově.
WITH "ent" AS (
  SELECT e."id", e."user_id", e."entries_total", e."entries_used", e."class_type_id", e."valid_from", e."valid_until"
  FROM "entitlements" e JOIN "orders" o ON o."id" = e."order_id"
  WHERE o."number" = 1121 AND o."status"::text = 'paid' AND e."kind"::text = 'pass' AND e."status"::text = 'active'
), "ses" AS (
  SELECT s."id", s."capacity", s."class_type_id", s."starts_at", ct."pass_entries", ct."pass_surcharge", ct."no_pass"
  FROM "class_sessions" s JOIN "class_types" ct ON ct."id" = s."class_type_id"
  WHERE s."id" = 'dae12072-7e55-47d1-854b-ebd8d7edb3d9' AND s."status"::text = 'scheduled' AND s."starts_at" > now()
), "spot" AS (
  SELECT "ent"."id" AS "ent_id", "ent"."user_id", "ses"."id" AS "session_id", w."id" AS "waitlist_id",
    (CASE WHEN "ent"."class_type_id" IS NOT NULL THEN 1 ELSE greatest(1, "ses"."pass_entries") END) * coalesce(w."seats", 1) AS "need",
    -- a pass just for Reformer has no surcharge; a general one pays the class's pass surcharge
    CASE WHEN "ent"."class_type_id" IS NOT NULL THEN 0 ELSE coalesce("ses"."pass_surcharge", 0) * coalesce(w."seats", 1) END AS "surcharge",
    "ent"."entries_total", "ent"."entries_used"
  FROM "ent" CROSS JOIN "ses"
  LEFT JOIN "bookings" w ON w."user_id" = "ent"."user_id" AND w."session_id" = "ses"."id" AND w."status"::text = 'waitlist'
  WHERE ("ent"."class_type_id" IS NULL OR "ent"."class_type_id" = "ses"."class_type_id")
    AND ("ent"."class_type_id" IS NOT NULL OR NOT "ses"."no_pass")
    AND "ent"."valid_from" <= "ses"."starts_at" AND "ent"."valid_until" > "ses"."starts_at"
    AND NOT EXISTS (SELECT 1 FROM "bookings" b WHERE b."user_id" = "ent"."user_id" AND b."session_id" = "ses"."id" AND b."status"::text NOT IN ('cancelled', 'waitlist'))
    AND (SELECT coalesce(sum(b."seats"), 0) FROM "bookings" b
         WHERE b."session_id" = "ses"."id" AND b."status"::text IN ('pending_payment', 'confirmed', 'attended', 'no_show')) + coalesce(w."seats", 1) <= "ses"."capacity"
), "take" AS (
  SELECT * FROM "spot" WHERE "entries_total" IS NULL OR "entries_used" + "need" <= "entries_total"
), "promoted" AS (
  UPDATE "bookings" b SET "status" = 'confirmed', "method" = 'pass', "entitlement_id" = "take"."ent_id",
    "entries_charged" = "take"."need", "credits_charged" = 0, "surcharge" = "take"."surcharge", "surcharge_paid_at" = NULL
  FROM "take" WHERE b."id" = "take"."waitlist_id"
  RETURNING b."id"
), "booked" AS (
  INSERT INTO "bookings" ("user_id", "session_id", "status", "method", "entitlement_id", "entries_charged", "surcharge")
  SELECT "take"."user_id", "take"."session_id", 'confirmed', 'pass', "take"."ent_id", "take"."need", "take"."surcharge"
  FROM "take" WHERE "take"."waitlist_id" IS NULL
  RETURNING "id"
)
UPDATE "entitlements" e SET "entries_used" = e."entries_used" + "take"."need"
FROM "take"
WHERE e."id" = "take"."ent_id" AND e."entries_total" IS NOT NULL
  AND (EXISTS (SELECT 1 FROM "promoted") OR EXISTS (SELECT 1 FROM "booked"));
