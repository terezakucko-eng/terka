-- Klientka z rodiny (stejná jako v 0082, podle otisku jména): její „Vstup zdarma“ na lekce (teď 365) neomezeně –
-- bez limitu vstupů, platnost do konce roku 2030. Úvodní lekce zdarma a vstupy na Reformer se nemění.
UPDATE "entitlements" e
SET "entries_total" = NULL, "valid_until" = GREATEST(e."valid_until", '2030-12-31 22:59:00+00'::timestamptz), "status" = 'active'
WHERE e."kind" = 'free'
  AND e."class_type_id" IS NULL
  AND e."name" NOT LIKE 'Úvodní lekce%'
  AND (e."entries_total" >= 100 OR e."valid_until" >= e."valid_from" + interval '300 days')
  AND e."user_id" IN (
    SELECT "id" FROM "users"
    WHERE md5(lower(trim("name"))) IN ('402e362ca6e41e6d768941d8219b53a6', 'e47077d45fad64f240ebcf4a2e1afd05',
      'a48ba8213d23c9011b03c45d353decdd', '5e26248aadb03aa5937ecb1a4849da7d')
  )
  AND (SELECT count(*) FROM "users" WHERE md5(lower(trim("name"))) IN ('402e362ca6e41e6d768941d8219b53a6',
    'e47077d45fad64f240ebcf4a2e1afd05', 'a48ba8213d23c9011b03c45d353decdd', '5e26248aadb03aa5937ecb1a4849da7d')) = 1;
