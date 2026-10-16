-- Klientka (podle otisku příjmení) chtěla Členství Reformer od ledna a koupit jí ho nešlo – nastavujeme ho za ni.
-- 1) Má členství se závazkem, které platí i v lednu: přejde na Členství Reformer od ledna (jako přechod v Můj účet) –
--    závazek se nemění, do prosince platí dosavadní příspěvek, od ledna 2 500 Kč a 8× Reformer v ceně.
UPDATE "entitlements" e SET
  "product_id" = p."id", "name" = p."name",
  "monthly_fee_before" = CASE WHEN e."monthly_fee_until" IS NOT NULL AND e."monthly_fee_until" < to_char(now() + interval '1 month', 'YYYY-MM') THEN NULL ELSE e."monthly_fee" END,
  "monthly_fee" = p."price", "monthly_fee_until" = NULL,
  "included_class_type_id" = p."included_class_type_id", "included_per_month" = p."included_per_month", "included_from" = '2027-01'
FROM "products" p
WHERE p."id" = 'b09203a4-b468-4653-be2b-01d41922d888' AND p."is_active" AND p."archived_at" IS NULL
  AND e."id" = (
    SELECT x."id" FROM "entitlements" x LEFT JOIN "products" xp ON xp."id" = x."product_id"
    WHERE x."user_id" IN (SELECT "id" FROM "users" WHERE EXISTS (SELECT 1 FROM regexp_split_to_table(lower(trim("name")), '\s+') w WHERE md5(w) IN ('750d082c1299ae67208f0d1e0a36c373', 'cc8035ef80c65185d318f9583f1bf892'))) AND x."kind" = 'membership' AND x."status" = 'active'
      AND x."valid_until" > '2027-01-01T00:00:00+01:00' AND x."subscription_id" IS NULL AND NOT x."renewal_cancelled"
      AND x."included_per_month" = 0 AND COALESCE(xp."commitment_months", 12) > 0
    ORDER BY x."valid_until" DESC LIMIT 1)
  AND (SELECT count(*) FROM "users" WHERE EXISTS (SELECT 1 FROM regexp_split_to_table(lower(trim("name")), '\s+') w WHERE md5(w) IN ('750d082c1299ae67208f0d1e0a36c373', 'cc8035ef80c65185d318f9583f1bf892'))) = 1
  AND NOT EXISTS (SELECT 1 FROM "entitlements" r WHERE r."user_id" = e."user_id" AND r."product_id" = p."id" AND r."status" = 'active')
  -- she's mid-purchase (an order waiting for payment, or paid): that order sets it up
  AND NOT EXISTS (SELECT 1 FROM "orders" o WHERE o."user_id" = e."user_id" AND o."product_id" = p."id"
    AND (o."status" = 'paid' OR (o."status" = 'pending' AND (o."expires_at" IS NULL OR o."expires_at" > now()))))
  AND (SELECT count(*) FROM "entitlements" t WHERE t."product_id" = p."id" AND t."status" = 'active' AND t."valid_until" > now())
    + (SELECT count(*) FROM "orders" o WHERE o."product_id" = p."id" AND o."status" = 'pending' AND (o."expires_at" IS NULL OR o."expires_at" > now()))
    < COALESCE(p."max_active", 1000);--> statement-breakpoint
-- 2) Jinak (členství končí v prosinci, je bez závazku nebo žádné nemá): nové Členství Reformer od 1. 1. 2027
--    jako z předprodeje; lednový příspěvek přijde 1. 1. výzvou.
INSERT INTO "entitlements" ("user_id", "kind", "product_id", "name", "entries_total", "valid_from", "valid_until", "monthly_fee", "included_class_type_id", "included_per_month", "note")
SELECT u."id", 'membership', p."id", p."name", NULL, '2027-01-01T00:00:00+01:00'::timestamptz,
  '2027-01-01T00:00:00+01:00'::timestamptz + make_interval(days => COALESCE(p."validity_days", 365)),
  p."price", p."included_class_type_id", p."included_per_month", 'Nastaveno studiem – platí od 1. 1. 2027'
FROM "users" u CROSS JOIN "products" p
WHERE p."id" = 'b09203a4-b468-4653-be2b-01d41922d888' AND p."is_active" AND p."archived_at" IS NULL
  AND u."id" IN (SELECT "id" FROM "users" WHERE EXISTS (SELECT 1 FROM regexp_split_to_table(lower(trim("name")), '\s+') w WHERE md5(w) IN ('750d082c1299ae67208f0d1e0a36c373', 'cc8035ef80c65185d318f9583f1bf892')))
  AND (SELECT count(*) FROM "users" WHERE EXISTS (SELECT 1 FROM regexp_split_to_table(lower(trim("name")), '\s+') w WHERE md5(w) IN ('750d082c1299ae67208f0d1e0a36c373', 'cc8035ef80c65185d318f9583f1bf892'))) = 1
  AND NOT EXISTS (SELECT 1 FROM "entitlements" r WHERE r."user_id" = u."id" AND r."product_id" = p."id" AND r."status" = 'active')
  -- she's mid-purchase (an order waiting for payment, or paid): that order sets it up
  AND NOT EXISTS (SELECT 1 FROM "orders" o WHERE o."user_id" = u."id" AND o."product_id" = p."id"
    AND (o."status" = 'paid' OR (o."status" = 'pending' AND (o."expires_at" IS NULL OR o."expires_at" > now()))))
  AND (SELECT count(*) FROM "entitlements" t WHERE t."product_id" = p."id" AND t."status" = 'active' AND t."valid_until" > now())
    + (SELECT count(*) FROM "orders" o WHERE o."product_id" = p."id" AND o."status" = 'pending' AND (o."expires_at" IS NULL OR o."expires_at" > now()))
    < COALESCE(p."max_active", 1000);--> statement-breakpoint
-- 3) Členství bez závazku, které by běželo dál, skončí s prosincem (od ledna platí Členství Reformer).
UPDATE "entitlements" e SET "valid_until" = '2027-01-01T00:00:00+01:00', "renewal_cancelled" = true
FROM "products" fp
WHERE fp."id" = e."product_id" AND fp."commitment_months" = 0
  AND e."kind" = 'membership' AND e."status" = 'active' AND e."subscription_id" IS NULL AND e."valid_until" > '2027-01-01T00:00:00+01:00'
  AND e."user_id" IN (SELECT "id" FROM "users" WHERE EXISTS (SELECT 1 FROM regexp_split_to_table(lower(trim("name")), '\s+') w WHERE md5(w) IN ('750d082c1299ae67208f0d1e0a36c373', 'cc8035ef80c65185d318f9583f1bf892')))
  AND (SELECT count(*) FROM "users" WHERE EXISTS (SELECT 1 FROM regexp_split_to_table(lower(trim("name")), '\s+') w WHERE md5(w) IN ('750d082c1299ae67208f0d1e0a36c373', 'cc8035ef80c65185d318f9583f1bf892'))) = 1
  AND EXISTS (SELECT 1 FROM "entitlements" r WHERE r."user_id" = e."user_id" AND r."product_id" = 'b09203a4-b468-4653-be2b-01d41922d888' AND r."valid_from" = '2027-01-01T00:00:00+01:00' AND r."note" = 'Nastaveno studiem – platí od 1. 1. 2027');
