ALTER TABLE "entitlements" ADD COLUMN "monthly_fee_until" text;--> statement-breakpoint
-- Dvě členky mají v listopadu a prosinci 2026 klasické členství za speciální cenu 1 000 Kč měsíčně; od ledna platí ceník 2027.
-- Jména do veřejného repozitáře nepatří: klientky se hledají podle otisku (md5) příjmení bez diakritiky.
-- Každému příjmení musí odpovídat jediná klientka (když je jich víc, jediná se členstvím, případně jediná, která už platí 1 000 Kč) – jinak se nic nezmění.
CREATE TEMP TABLE "special_fee_users" AS
WITH "words" AS (
  SELECT u."id", md5("w") AS "h"
  FROM "users" u, regexp_split_to_table(translate(lower(u."name"), 'áäčďéěëíňóöôřšťúůüýž', 'aacdeeeinooorstuuuyz'), '\s+') AS "w"
  WHERE u."role"::text = 'client'
),
"hits" AS (
  SELECT DISTINCT "id", ("h" = '62f07ab7e78f2867689adf334b61ad7c') AS "second"
  FROM "words"
  WHERE "h" IN ('fd9db0042beb5a1960fee407f97fdb4f', '3fd7c799d7c21814a2fccbd587efeccd', '62f07ab7e78f2867689adf334b61ad7c')
),
"members" AS (
  SELECT h.* FROM "hits" h
  WHERE EXISTS (SELECT 1 FROM "entitlements" e WHERE e."user_id" = h."id" AND e."kind"::text = 'membership' AND e."status"::text = 'active')
),
"paying" AS (
  SELECT m.* FROM "members" m
  WHERE EXISTS (SELECT 1 FROM "entitlements" e WHERE e."user_id" = m."id" AND e."kind"::text = 'membership' AND e."status"::text = 'active' AND e."monthly_fee" = 100000)
)
SELECT h."id" FROM "hits" h WHERE (SELECT count(*) FROM "hits" x WHERE x."second" = h."second") = 1
UNION
SELECT m."id" FROM "members" m
WHERE (SELECT count(*) FROM "hits" x WHERE x."second" = m."second") > 1 AND (SELECT count(*) FROM "members" x WHERE x."second" = m."second") = 1
UNION
SELECT p."id" FROM "paying" p
WHERE (SELECT count(*) FROM "members" x WHERE x."second" = p."second") > 1 AND (SELECT count(*) FROM "paying" x WHERE x."second" = p."second") = 1;--> statement-breakpoint
-- Jejich platné členství: klasické (bez lekcí v ceně, se závazkem), 1 000 Kč do prosince 2026, platí aspoň do konce roku.
UPDATE "entitlements" e SET
  "monthly_fee" = 100000,
  "monthly_fee_until" = '2026-12',
  "included_class_type_id" = NULL,
  "included_per_month" = 0,
  "included_from" = NULL,
  "product_id" = CASE WHEN t."other" THEN COALESCE((SELECT c."id" FROM "products" c WHERE c."kind"::text = 'membership' AND c."name" LIKE '%2026%' AND c."included_per_month" = 0 AND c."commitment_months" > 0 AND c."archived_at" IS NULL ORDER BY c."is_active" DESC, c."sort_order" LIMIT 1), e."product_id") ELSE e."product_id" END,
  "name" = CASE WHEN t."other" THEN COALESCE((SELECT c."name" FROM "products" c WHERE c."kind"::text = 'membership' AND c."name" LIKE '%2026%' AND c."included_per_month" = 0 AND c."commitment_months" > 0 AND c."archived_at" IS NULL ORDER BY c."is_active" DESC, c."sort_order" LIMIT 1), e."name") ELSE e."name" END,
  "valid_until" = CASE WHEN t."flexible" THEN '2027-01-01T00:00:00+01:00'::timestamptz ELSE GREATEST(e."valid_until", '2027-01-01T00:00:00+01:00'::timestamptz) END,
  "note" = COALESCE(NULLIF(e."note", ''), 'Speciální cena 1 000 Kč do 12/2026')
FROM (
  SELECT DISTINCT ON (x."user_id") x."id",
    COALESCE(p."included_per_month" > 0 OR p."commitment_months" = 0, false) AS "other",
    COALESCE(p."commitment_months" = 0, false) AS "flexible"
  FROM "entitlements" x LEFT JOIN "products" p ON p."id" = x."product_id"
  WHERE x."user_id" IN (SELECT "id" FROM "special_fee_users") AND x."kind"::text = 'membership' AND x."status"::text = 'active' AND x."subscription_id" IS NULL
  ORDER BY x."user_id", x."valid_until" DESC
) t
WHERE e."id" = t."id";--> statement-breakpoint
-- Kdo platné členství nemá, dostane klasické na listopad a prosinec.
INSERT INTO "entitlements" ("user_id", "kind", "product_id", "name", "valid_from", "valid_until", "monthly_fee", "monthly_fee_until", "note")
SELECT s."id", 'membership', c."id", COALESCE(c."name", 'Členství 2026'), '2026-11-01T00:00:00+01:00', '2027-01-01T00:00:00+01:00', 100000, '2026-12', 'Speciální cena 1 000 Kč do 12/2026'
FROM "special_fee_users" s
LEFT JOIN LATERAL (
  SELECT p."id", p."name" FROM "products" p
  WHERE p."kind"::text = 'membership' AND p."name" LIKE '%2026%' AND p."included_per_month" = 0 AND p."commitment_months" > 0 AND p."archived_at" IS NULL
  ORDER BY p."is_active" DESC, p."sort_order" LIMIT 1
) c ON true
WHERE NOT EXISTS (SELECT 1 FROM "entitlements" e WHERE e."user_id" = s."id" AND e."kind"::text = 'membership' AND e."status"::text = 'active');--> statement-breakpoint
-- Nezaplacené výzvy za listopad a prosinec: 1 000 Kč.
UPDATE "orders" SET "amount" = 100000
WHERE "user_id" IN (SELECT "id" FROM "special_fee_users")
  AND "kind"::text = 'membership_fee' AND "status"::text = 'pending' AND "period" IN ('2026-11', '2026-12');--> statement-breakpoint
DROP TABLE "special_fee_users";
