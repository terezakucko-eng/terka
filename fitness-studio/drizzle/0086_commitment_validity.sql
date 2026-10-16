-- Členství se závazkem zaplacené jednorázově (převodem, v předprodeji, na recepci – ne předplatné kartou) dostalo
-- platnost jen podle „Platnost (dny)“ v ceníku (31 dní), ne na celý závazek. Platí teď do konce posledního měsíce
-- závazku (23:59), měsíční příspěvky chodí výzvou. Týká se i Členství Reformer nastaveného studiem od 1. 1. 2027.
UPDATE "entitlements" e
SET "valid_until" = (date_trunc('month', e."valid_from" AT TIME ZONE 'Europe/Prague') + make_interval(months => p."commitment_months")) AT TIME ZONE 'Europe/Prague' - interval '1 minute'
FROM "products" p
WHERE p."id" = e."product_id" AND p."kind" = 'membership' AND p."commitment_months" > 0
  AND e."kind" = 'membership' AND e."status" = 'active' AND e."subscription_id" IS NULL
  AND (e."order_id" IS NOT NULL OR e."note" = 'Nastaveno studiem – platí od 1. 1. 2027')
  AND e."valid_until" > now()
  AND e."valid_until" <= e."valid_from" + interval '32 days';
