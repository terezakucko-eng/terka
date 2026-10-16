-- Klientka z 0085 (podle otisku příjmení) má členství do konce roku 2026 – zneplatněné „Členství 2026“ (převod ze starého
-- systému) platí zase. Jen když odpovídá právě jedna klientka.
UPDATE "entitlements" SET "status" = 'active'
WHERE "kind" = 'membership' AND "status" = 'cancelled' AND "name" LIKE 'Členství 2026%'
  AND "valid_until" > now() AND "valid_until" <= '2027-01-01T00:00:00+01:00'
  AND "user_id" IN (SELECT "id" FROM "users" WHERE EXISTS (SELECT 1 FROM regexp_split_to_table(lower(trim("name")), '\s+') w WHERE md5(w) IN ('750d082c1299ae67208f0d1e0a36c373', 'cc8035ef80c65185d318f9583f1bf892')))
  AND (SELECT count(*) FROM "users" WHERE EXISTS (SELECT 1 FROM regexp_split_to_table(lower(trim("name")), '\s+') w WHERE md5(w) IN ('750d082c1299ae67208f0d1e0a36c373', 'cc8035ef80c65185d318f9583f1bf892'))) = 1;
