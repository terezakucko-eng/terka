-- Členství zaplacené jednorázově (převodem, v předprodeji, na recepci – ne předplatné kartou) platí 365 dní, do 23:59
-- posledního dne – se závazkem i bez něj (to jde dál kdykoli ukončit). Mění se jen ta, která mají platnost tak, jak ji
-- dal ceník (31 dní, u členství bez závazku 10 let) nebo migrace 0086 (do konce posledního měsíce závazku); ručně
-- upravená, ukončená a předplatná kartou zůstávají.
UPDATE "entitlements" e
SET "valid_until" = (date_trunc('day', e."valid_from" AT TIME ZONE 'Europe/Prague') + interval '365 days') AT TIME ZONE 'Europe/Prague' - interval '1 minute'
FROM "products" p
WHERE p."id" = e."product_id" AND p."kind" = 'membership'
  AND e."kind" = 'membership' AND e."status" = 'active' AND e."subscription_id" IS NULL AND NOT e."renewal_cancelled"
  AND (e."order_id" IS NOT NULL OR e."note" = 'Nastaveno studiem – platí od 1. 1. 2027')
  AND e."valid_until" > now()
  AND (
    e."valid_until" = e."valid_from" + make_interval(secs => COALESCE(p."validity_days", 30) * 86400)
    OR e."valid_until" = (date_trunc('month', e."valid_from" AT TIME ZONE 'Europe/Prague') + make_interval(months => p."commitment_months")) AT TIME ZONE 'Europe/Prague' - interval '1 minute'
  );
