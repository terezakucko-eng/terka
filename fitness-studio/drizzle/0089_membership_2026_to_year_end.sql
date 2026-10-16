-- Všechny členky s „Členstvím 2026“ ho mají do 31. 12. 2026 (23:59) – ať jim platnost končí dřív, nebo později.
-- Kromě členství se slevou 50 % (sleva nebo 50 v názvu či poznámce, členství z produktu se slevou v názvu, nebo měsíční
-- příspěvek nejvýš 750 Kč) – to zůstává, jak je. Zneplatněná a placená předplatným kartou (obnovuje se po měsících)
-- se nemění.
UPDATE "entitlements" e
SET "valid_until" = '2026-12-31T23:59:00+01:00'
WHERE e."kind" = 'membership' AND e."status" = 'active' AND e."subscription_id" IS NULL
  AND lower(e."name") LIKE 'členství 2026%'
  AND e."valid_from" < '2027-01-01T00:00:00+01:00' AND e."valid_from" >= '2026-01-01T00:00:00+01:00'
  AND e."valid_until" <> '2026-12-31T23:59:00+01:00'
  AND lower(e."name") NOT LIKE '%slev%' AND e."name" NOT LIKE '%50%'
  AND lower(coalesce(e."note", '')) NOT LIKE '%slev%' AND coalesce(e."note", '') NOT LIKE '%50%'
  AND (e."monthly_fee" IS NULL OR e."monthly_fee" > 75000)
  AND NOT EXISTS (SELECT 1 FROM "products" p WHERE p."id" = e."product_id" AND (lower(p."name") LIKE '%slev%' OR p."name" LIKE '%50%'));
