ALTER TABLE "entitlements" ADD COLUMN "monthly_fee_after" integer;--> statement-breakpoint
-- Dvě klientky: členství od 1. 11. 2026 na 12 měsíců, každá 1 000 Kč měsíčně. Listopad a prosinec platí první
-- za obě (2 000 Kč), druhá v těch měsících nic; od ledna 2027 platí každá svých 1 000 Kč.
-- Jména do veřejného repozitáře nepatří: klientky se hledají podle otisku (md5) příjmení bez diakritiky, jako v 0074.
-- Každému příjmení musí odpovídat jediná klientka (když je jich víc, jediná se členstvím) a obě musí jít nastavit –
-- jinak se nic nezmění.
CREATE TEMP TABLE "pair_fee_users" AS
WITH "words" AS (
  SELECT u."id", md5("w") AS "h"
  FROM "users" u, regexp_split_to_table(translate(lower(u."name"), 'áäčďéěëíňóöôřšťúůüýž', 'aacdeeeinooorstuuuyz'), '\s+') AS "w"
  WHERE u."role"::text = 'client' AND u."deleted_at" IS NULL
),
"hits" AS (
  SELECT DISTINCT "id", ("h" = 'f5e1943993c370caf822494afc842f88') AS "payer"
  FROM "words"
  WHERE "h" IN ('f5e1943993c370caf822494afc842f88', 'e018630b6d7d9c1fdebb6b9815b21807')
),
"members" AS (
  SELECT h.* FROM "hits" h
  WHERE EXISTS (SELECT 1 FROM "entitlements" e WHERE e."user_id" = h."id" AND e."kind"::text = 'membership' AND e."status"::text = 'active')
)
SELECT h."id", h."payer" FROM "hits" h WHERE (SELECT count(*) FROM "hits" x WHERE x."payer" = h."payer") = 1
UNION
SELECT m."id", m."payer" FROM "members" m
WHERE (SELECT count(*) FROM "hits" x WHERE x."payer" = m."payer") > 1 AND (SELECT count(*) FROM "members" x WHERE x."payer" = m."payer") = 1;--> statement-breakpoint
-- Její platné členství (klasické, bez lekcí v ceně, ne kartou předplatné) se upraví; kdo žádné nemá, dostane nové.
CREATE TEMP TABLE "pair_fee" AS
SELECT p."id" AS "user_id", p."payer",
  (SELECT x."id" FROM "entitlements" x
    WHERE x."user_id" = p."id" AND x."kind"::text = 'membership' AND x."status"::text = 'active' AND x."valid_until" > now()
    ORDER BY x."valid_until" DESC LIMIT 1) AS "ent_id"
FROM "pair_fee_users" p;--> statement-breakpoint
DELETE FROM "pair_fee"
WHERE (SELECT count(*) FROM "pair_fee" WHERE "payer") <> 1
  OR (SELECT count(*) FROM "pair_fee" WHERE NOT "payer") <> 1
  OR EXISTS (
    SELECT 1 FROM "pair_fee" t JOIN "entitlements" e ON e."id" = t."ent_id"
    WHERE e."subscription_id" IS NOT NULL OR e."included_per_month" > 0 OR e."included_from" IS NOT NULL
  );--> statement-breakpoint
UPDATE "entitlements" e SET
  "valid_from" = LEAST(e."valid_from", '2026-11-01T00:00:00+01:00'::timestamptz),
  "valid_until" = '2027-11-01T00:00:00+01:00'::timestamptz,
  "monthly_fee" = CASE WHEN t."payer" THEN 200000 ELSE 0 END,
  "monthly_fee_until" = '2026-12',
  "monthly_fee_after" = 100000,
  "monthly_fee_before" = NULL,
  "renewal_cancelled" = false,
  "note" = CASE WHEN t."payer"
    THEN 'Od 11/2026 na 12 měsíců – 11–12/2026 2 000 Kč i za druhé členství, od 1/2027 1 000 Kč'
    ELSE 'Od 11/2026 na 12 měsíců – 11–12/2026 platí druhá členka, od 1/2027 1 000 Kč' END
FROM "pair_fee" t
WHERE e."id" = t."ent_id";--> statement-breakpoint
INSERT INTO "entitlements" ("user_id", "kind", "product_id", "name", "valid_from", "valid_until", "monthly_fee", "monthly_fee_until", "monthly_fee_after", "note")
SELECT t."user_id", 'membership', c."id", COALESCE(c."name", 'Členství 2026'), '2026-11-01T00:00:00+01:00', '2027-11-01T00:00:00+01:00',
  CASE WHEN t."payer" THEN 200000 ELSE 0 END, '2026-12', 100000,
  CASE WHEN t."payer"
    THEN 'Od 11/2026 na 12 měsíců – 11–12/2026 2 000 Kč i za druhé členství, od 1/2027 1 000 Kč'
    ELSE 'Od 11/2026 na 12 měsíců – 11–12/2026 platí druhá členka, od 1/2027 1 000 Kč' END
FROM "pair_fee" t
LEFT JOIN LATERAL (
  SELECT p."id", p."name" FROM "products" p
  WHERE p."kind"::text = 'membership' AND p."name" LIKE '%2026%' AND p."included_per_month" = 0 AND p."commitment_months" > 0 AND p."archived_at" IS NULL
  ORDER BY p."is_active" DESC, p."sort_order" LIMIT 1
) c ON true
WHERE t."ent_id" IS NULL;--> statement-breakpoint
-- Výzvy, které už čekají: listopad a prosinec 2 000 Kč u první, u druhé se ruší; od ledna 1 000 Kč.
UPDATE "orders" o SET "amount" = 200000
FROM "pair_fee" t
WHERE o."user_id" = t."user_id" AND t."payer"
  AND o."kind"::text = 'membership_fee' AND o."status"::text = 'pending' AND o."period" IN ('2026-11', '2026-12');--> statement-breakpoint
UPDATE "orders" o SET "status" = 'cancelled'
FROM "pair_fee" t
WHERE o."user_id" = t."user_id" AND NOT t."payer"
  AND o."kind"::text = 'membership_fee' AND o."status"::text = 'pending' AND o."period" IN ('2026-11', '2026-12');--> statement-breakpoint
UPDATE "orders" o SET "amount" = 100000
FROM "pair_fee" t
WHERE o."user_id" = t."user_id"
  AND o."kind"::text = 'membership_fee' AND o."status"::text = 'pending' AND o."period" > '2026-12';--> statement-breakpoint
-- Listopadová výzva první klientky, pokud ještě žádná není (měsíční běh pro listopad už proběhl).
-- Dynamicky a jen když je co vložit: na čisté databázi běží všechny migrace v jedné transakci s ALTER TYPE,
-- který 'membership_fee' přidal, a tam by ji Postgres použít nedovolil.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "pair_fee" t
    WHERE t."payer"
      AND NOT EXISTS (
        SELECT 1 FROM "orders" o
        WHERE o."user_id" = t."user_id" AND o."kind"::text = 'membership_fee' AND o."period" = '2026-11' AND o."status"::text IN ('pending', 'paid')
      )
  ) THEN
    EXECUTE $q$
      INSERT INTO "orders" ("user_id", "kind", "period", "description", "amount", "provider")
      SELECT t."user_id", 'membership_fee', '2026-11', 'Členský příspěvek – listopad 2026', 200000, 'transfer'
      FROM "pair_fee" t
      WHERE t."payer"
        AND NOT EXISTS (
          SELECT 1 FROM "orders" o
          WHERE o."user_id" = t."user_id" AND o."kind"::text = 'membership_fee' AND o."period" = '2026-11' AND o."status"::text IN ('pending', 'paid')
        )
    $q$;
  END IF;
END $$;--> statement-breakpoint
DROP TABLE "pair_fee";--> statement-breakpoint
DROP TABLE "pair_fee_users";
