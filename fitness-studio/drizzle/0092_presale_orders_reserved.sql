-- Členství objednaná v předprodeji (na leden 2027), která ještě nejsou zaplacená: zapíšou se klientce rovnou jako
-- členství od začátku ceníku (365 dní) a první měsíc zaplatí výzvou v prosinci jako ostatní členky. Objednávka se
-- zruší, ať neplatí dvakrát. Jedna objednávka na klientku a členství; kdo ho už má, tomu se nic nepřidá.
INSERT INTO "entitlements" ("user_id", "kind", "product_id", "name", "valid_from", "valid_until", "monthly_fee", "included_class_type_id", "included_per_month", "note")
SELECT DISTINCT ON (o."user_id", p."id")
  o."user_id", 'membership', p."id", p."name", p."sale_from",
  (date_trunc('day', p."sale_from" AT TIME ZONE 'Europe/Prague') + interval '365 days') AT TIME ZONE 'Europe/Prague' - interval '1 minute',
  CASE WHEN p."commitment_months" = 0 OR p."included_per_month" > 0 THEN p."price" END,
  p."included_class_type_id", p."included_per_month",
  'Předprodej – první měsíc zaplatí výzvou v prosinci'
FROM "orders" o JOIN "products" p ON p."id" = o."product_id"
WHERE o."kind" = 'product' AND o."status" = 'pending' AND (o."expires_at" IS NULL OR o."expires_at" > now())
  AND p."kind" = 'membership' AND p."sale_from" > now()
  AND NOT EXISTS (SELECT 1 FROM "entitlements" e WHERE e."user_id" = o."user_id" AND e."product_id" = p."id" AND e."status" = 'active' AND e."valid_until" > now())
ORDER BY o."user_id", p."id", o."created_at";--> statement-breakpoint
UPDATE "orders" o SET "status" = 'cancelled'
FROM "products" p
WHERE p."id" = o."product_id" AND o."kind" = 'product' AND o."status" = 'pending' AND (o."expires_at" IS NULL OR o."expires_at" > now())
  AND p."kind" = 'membership' AND p."sale_from" > now()
  AND EXISTS (SELECT 1 FROM "entitlements" e WHERE e."user_id" = o."user_id" AND e."product_id" = p."id" AND e."status" = 'active' AND e."valid_until" > now());
