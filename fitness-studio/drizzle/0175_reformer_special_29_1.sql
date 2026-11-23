-- Reformer special (přání studia 23. 11. 2026): pátek 29. 1. 2027, 16:00–19:00. Technika na reformeru, cvičí se ve dvojicích
-- (12 lidí na 6 strojích), tištěné materiály, jak cvičit doma bez reformeru, a občerstvení. Nečlenové 690 Kč, členové mají
-- akci v ceně členství a doplácí 390 Kč; permanentky, kredity ani vstupy zdarma na ni neplatí. Rezervace otevřené hned.
-- Zdravé tělo | silový trénink, které se ten den v 16:00 překrývá, odpadá (jen když na něm nikdo není).

-- 1) Lekce Reformer special (vlastní typ: vlastní ceny a pravidla). Pevné id – vznikne jednou.
INSERT INTO "class_types" ("id", "name", "slug", "description", "keywords", "duration_min", "capacity", "credit_cost", "drop_in_price",
  "color", "image_url", "level", "member_surcharge", "no_free_entry", "pass_card_entry", "no_pass", "no_credits", "cancellation_hours", "is_active", "sort_order")
SELECT '907efc90-899b-47a0-906f-6e4b41357c27', 'Reformer special', 'reformer-special',
  'Reformer special je odpoledne, kdy zpomalíme a vyladíme techniku. Ukážeme si, proč každý pohyb děláme právě takhle, a doladíme ho na tvoje tělo – na dalších lekcích pak ucítíš, jak ti to jde líp. Cvičí se ve dvojicích na šesti strojích, takže přijď ideálně se svou parťačkou (nebo se spárujete u nás). Prozradíme ti taky, jak cvičit doma bez reformeru skoro jako na něm, a domů si odneseš tištěný návod. Mezi tím na tebe čeká malé občerstvení. Doporučujeme protiskluzové ponožky – když je nemáš, koupíš si je u nás na recepci. 🧦',
  'reformer workshop Ostrava, reformer technika, pilates reformer Ostrava, cvičení doma jako na reformeru',
  180, 12, 600, 69000, r."color", r."image_url", 'Pro všechny', 39000, true, false, true, true, coalesce(r."cancellation_hours", 24), true, r."sort_order"
FROM "class_types" r
WHERE r."slug" = 'reformer-fusion'
  AND NOT EXISTS (SELECT 1 FROM "class_types" x WHERE x."id" = '907efc90-899b-47a0-906f-6e4b41357c27' OR x."slug" = 'reformer-special');
--> statement-breakpoint
-- 2) Termín v pátek 29. 1. 2027 16:00–19:00, lektorka a sál jako u Reformeru, rezervace otevřené hned.
WITH who AS (
  SELECT s."instructor_id", s."room" FROM "class_sessions" s JOIN "class_types" t ON t."id" = s."class_type_id"
  WHERE t."slug" = 'reformer-fusion' AND s."status"::text = 'scheduled' AND s."starts_at" >= '2027-01-01 00:00:00+01'
  ORDER BY s."starts_at" LIMIT 1
)
INSERT INTO "class_sessions" ("id", "class_type_id", "instructor_id", "starts_at", "duration_min", "capacity", "credit_cost", "drop_in_price", "room", "booking_opens_at")
SELECT '22e83185-2450-44e8-b181-d68be9dcbdb5', ct."id", (SELECT "instructor_id" FROM who), '2027-01-29 16:00:00+01', 180, 12, ct."credit_cost", ct."drop_in_price",
  (SELECT "room" FROM who), '2026-11-23 00:00:00+01'
FROM "class_types" ct
WHERE ct."id" = '907efc90-899b-47a0-906f-6e4b41357c27'
  AND NOT EXISTS (SELECT 1 FROM "class_sessions" x WHERE x."id" = '22e83185-2450-44e8-b181-d68be9dcbdb5');
--> statement-breakpoint
-- 3) Zdravé tělo | silový trénink v pátek 29. 1. v 16:00 odpadá – jen když na něm nikdo není. Kde už někdo je, zůstává:
--    zrušit ho musí studio v administraci (vrátí vstupy a pošle e-mail).
UPDATE "class_sessions" s SET "status" = 'cancelled'
FROM "class_types" ct
WHERE ct."id" = s."class_type_id" AND ct."name" ILIKE 'Zdravé tělo%silov%'
  AND s."starts_at" = '2027-01-29 16:00:00+01' AND s."status"::text = 'scheduled' AND coalesce(s."title", '') = ''
  AND NOT EXISTS (SELECT 1 FROM "bookings" b WHERE b."session_id" = s."id" AND b."status"::text <> 'cancelled')
  AND EXISTS (SELECT 1 FROM "class_sessions" x WHERE x."id" = '22e83185-2450-44e8-b181-d68be9dcbdb5' AND x."status"::text = 'scheduled');
