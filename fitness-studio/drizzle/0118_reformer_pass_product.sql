-- Permanentka Reformer: 8 lekcí Reformer fusion za 3 490 Kč (jednotlivě 490 Kč), platnost 45 dní, v prodeji hned a i v roce 2027.
-- 1 vstup = 1 lekce, rezervace stejně brzy jako se Členstvím Reformer, bere místo ze Členství Reformer.
-- Zatím skrytá: stávající verze webu by ji prodala jako běžnou permanentku. Do nabídky ji zapne „V nabídce“ v Ceníku, až bude nasazená nová verze.
INSERT INTO "products" ("id", "kind", "name", "description", "price", "entries", "validity_days", "highlight", "is_active", "members_only", "link_only", "sort_order", "class_type_id", "shares_places_with")
SELECT '6bdbf271-9d5f-4260-b60b-946da3e254db', 'pass', 'Permanentka Reformer',
  'Reformer fusion bez členství – 8 lekcí výhodněji než jednotlivě. Omezený počet míst.',
  349000, 8, 45, false, false, false, false,
  (SELECT COALESCE(MAX("sort_order"), 0) + 1 FROM "products" WHERE "kind" = 'pass' AND "archived_at" IS NULL),
  ct."id", m."id"
FROM (SELECT "id" FROM "class_types" WHERE "slug" = 'reformer-fusion' LIMIT 1) ct
CROSS JOIN (SELECT "id" FROM "products" WHERE "id" = 'b09203a4-b468-4653-be2b-01d41922d888' AND "max_active" IS NOT NULL) m
ON CONFLICT ("id") DO NOTHING;
