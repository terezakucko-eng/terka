ALTER TABLE "entitlements" ADD COLUMN "included_class_type_id" uuid;--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "included_per_month" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "included_from" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "included_class_type_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "included_per_month" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_included_class_type_id_class_types_id_fk" FOREIGN KEY ("included_class_type_id") REFERENCES "public"."class_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_included_class_type_id_class_types_id_fk" FOREIGN KEY ("included_class_type_id") REFERENCES "public"."class_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- „Členství Reformer“ (2 290 Kč, 12 měsíců) a „Členství Reformer bez závazku“ (2 690 Kč): vše z členství + 4× Reformer fusion měsíčně bez doplatku.
-- Skryté – zapnou se v Ceníku až s tímhle kódem na webu (dřív by se prodávaly bez Reformerů v ceně).
-- Pořadí v ceníku: členství, Členství Reformer, bez závazku, Reformer bez závazku (dva sloupce: se závazkem / bez).
INSERT INTO "products" ("id", "kind", "name", "description", "price", "entries", "validity_days", "weekly_limit", "recurring", "highlight", "is_active", "members_only", "link_only", "sort_order", "commitment_months", "included_class_type_id", "included_per_month")
SELECT 'b09203a4-b468-4653-be2b-01d41922d888', 'membership', 'Členství Reformer',
  'Vše z členství a k tomu 4× Reformer fusion měsíčně bez doplatku.',
  229000, NULL, m."validity_days", NULL, false, false, false, false, false, m."sort_order" + 1, m."commitment_months", ct."id", 4
FROM (SELECT * FROM "products" WHERE "kind" = 'membership' AND "archived_at" IS NULL AND "is_active" AND NOT "link_only" AND "weekly_limit" IS NULL AND "commitment_months" > 0 ORDER BY "sort_order" LIMIT 1) m
CROSS JOIN (SELECT "id" FROM "class_types" WHERE "slug" = 'reformer-fusion' LIMIT 1) ct
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "products" ("id", "kind", "name", "description", "price", "entries", "validity_days", "weekly_limit", "recurring", "highlight", "is_active", "members_only", "link_only", "sort_order", "commitment_months", "included_class_type_id", "included_per_month")
SELECT '6dddd67f-2894-4d89-8044-f44cfd991061', 'membership', 'Členství Reformer bez závazku',
  'Stejné jako Členství Reformer – bez závazku, zrušíš ho kdykoli ke konci měsíce.',
  269000, NULL, 3650, NULL, false, false, false, false, false, m."sort_order" + 3, 0, ct."id", 4
FROM (SELECT * FROM "products" WHERE "kind" = 'membership' AND "archived_at" IS NULL AND "is_active" AND NOT "link_only" AND "weekly_limit" IS NULL AND "commitment_months" > 0 ORDER BY "sort_order" LIMIT 1) m
CROSS JOIN (SELECT "id" FROM "class_types" WHERE "slug" = 'reformer-fusion' LIMIT 1) ct
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
UPDATE "products" SET "sort_order" = m."sort_order" + 2
FROM (SELECT "sort_order" FROM "products" WHERE "kind" = 'membership' AND "archived_at" IS NULL AND "is_active" AND NOT "link_only" AND "weekly_limit" IS NULL AND "commitment_months" > 0 ORDER BY "sort_order" LIMIT 1) m
WHERE "products"."id" = 'b3d1c4a2-6f0e-4c1b-9a57-2e8d5f7c9a10' AND NOT "products"."is_active";
