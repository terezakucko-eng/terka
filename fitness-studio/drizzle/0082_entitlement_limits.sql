ALTER TABLE "entitlements" ADD COLUMN "same_day_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "before_hour" integer;--> statement-breakpoint
-- Reformer zdarma pro jednu klientku z rodiny (podle Terezy, 15. 10. 2026): ranní lekce (do 12:00) vždy,
-- ostatní lekce Reformeru jen v den lekce, když zbývá volné místo. Klientka podle otisku jména (md5) –
-- jméno nepatří do veřejného repozitáře; jen když sedí přesně jedna.
INSERT INTO "entitlements" ("user_id", "kind", "name", "entries_total", "class_type_id", "before_hour", "same_day_only", "valid_from", "valid_until", "note")
SELECT u."id", 'free', v.name, NULL, ct."id", v.before_hour, v.same_day, now(), '2030-12-31 22:59:00+00', 'Od Terezy'
FROM (
  SELECT "id" FROM "users"
  WHERE md5(lower(trim("name"))) IN ('402e362ca6e41e6d768941d8219b53a6', 'e47077d45fad64f240ebcf4a2e1afd05',
    'a48ba8213d23c9011b03c45d353decdd', '5e26248aadb03aa5937ecb1a4849da7d')
) u
CROSS JOIN (SELECT "id" FROM "class_types" WHERE "slug" LIKE '%reformer%' ORDER BY "is_active" DESC, "sort_order" LIMIT 1) ct
CROSS JOIN (VALUES
  ('Reformer zdarma – ranní lekce', 12, false),
  ('Reformer zdarma – volné místo v den lekce', NULL::integer, true)
) AS v(name, before_hour, same_day)
WHERE (SELECT count(*) FROM "users" WHERE md5(lower(trim("name"))) IN ('402e362ca6e41e6d768941d8219b53a6',
    'e47077d45fad64f240ebcf4a2e1afd05', 'a48ba8213d23c9011b03c45d353decdd', '5e26248aadb03aa5937ecb1a4849da7d')) = 1
  AND NOT EXISTS (SELECT 1 FROM "entitlements" e WHERE e."user_id" = u."id" AND e."name" = v.name);
