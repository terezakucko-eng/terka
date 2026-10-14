ALTER TABLE "class_types" ADD COLUMN "member_surcharge_next" integer;--> statement-breakpoint
ALTER TABLE "class_types" ADD COLUMN "member_surcharge_next_from" text;--> statement-breakpoint
ALTER TABLE "class_types" ADD COLUMN "price_note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "class_types" ADD COLUMN "price_note_until" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sale_from" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sale_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "max_active" integer;--> statement-breakpoint
-- Reformer: zaváděcí cena pro rok 2026 (členové doplácí 100 Kč); od 1. 1. 2027 platí ceník 2027 – doplatek 250 Kč pro všechna členství.
UPDATE "class_types" SET
  "price_note" = 'Zaváděcí cena pro rok 2026', "price_note_until" = '2027-01-01',
  "member_surcharge_next" = 25000, "member_surcharge_next_from" = '2027-01-01'
WHERE "slug" = 'reformer-fusion';--> statement-breakpoint
-- Členství Reformer (ceník 2027): 2 500 Kč, 6× Reformer fusion měsíčně v ceně, přednostní rezervace, nejvýš 4 členství. Zatím skryté.
UPDATE "products" SET
  "price" = 250000, "included_per_month" = 6, "max_active" = 4, "sale_from" = '2027-01-01T00:00:00+01:00',
  "description" = 'Vše z členství, 6× Reformer fusion měsíčně v ceně a přednostní rezervace Reformeru. Omezený počet míst.'
WHERE "id" = 'b09203a4-b468-4653-be2b-01d41922d888' AND NOT "is_active";--> statement-breakpoint
-- Varianta bez závazku za 2 690 Kč se nenabízí (nikdo ji nekoupil – byla skrytá).
DELETE FROM "products" WHERE "id" = '6dddd67f-2894-4d89-8044-f44cfd991061' AND NOT "is_active"
  AND NOT EXISTS (SELECT 1 FROM "entitlements" WHERE "product_id" = '6dddd67f-2894-4d89-8044-f44cfd991061')
  AND NOT EXISTS (SELECT 1 FROM "orders" WHERE "product_id" = '6dddd67f-2894-4d89-8044-f44cfd991061')
  AND NOT EXISTS (SELECT 1 FROM "vouchers" WHERE "product_id" = '6dddd67f-2894-4d89-8044-f44cfd991061');--> statement-breakpoint
-- „Členství 2026“ se prodává do konce roku, od 1. 1. 2027 „Členství 2027“ za stejnou cenu (zatím skryté).
INSERT INTO "products" ("id", "kind", "name", "description", "price", "entries", "validity_days", "weekly_limit", "recurring", "highlight", "is_active", "members_only", "link_only", "sort_order", "commitment_months", "sale_from")
SELECT 'f6e8d8e1-becd-4c1f-90c3-15f86465b278', 'membership', replace(m."name", '2026', '2027'), m."description", m."price", NULL, m."validity_days", NULL, m."recurring", m."highlight", false, false, false, m."sort_order", m."commitment_months", '2027-01-01T00:00:00+01:00'
FROM (SELECT * FROM "products" WHERE "kind" = 'membership' AND "archived_at" IS NULL AND "is_active" AND NOT "link_only" AND "weekly_limit" IS NULL AND "commitment_months" > 0 AND "included_per_month" = 0 AND "name" LIKE '%2026%' ORDER BY "sort_order" LIMIT 1) m
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
UPDATE "products" SET "sale_until" = '2027-01-01T00:00:00+01:00'
WHERE "kind" = 'membership' AND "archived_at" IS NULL AND "is_active" AND NOT "link_only" AND "weekly_limit" IS NULL AND "commitment_months" > 0 AND "included_per_month" = 0 AND "name" LIKE '%2026%' AND "sale_until" IS NULL
  AND EXISTS (SELECT 1 FROM "products" WHERE "id" = 'f6e8d8e1-becd-4c1f-90c3-15f86465b278');
