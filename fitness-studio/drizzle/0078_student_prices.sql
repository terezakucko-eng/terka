ALTER TABLE "products" ADD COLUMN "students_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "student_until" text;--> statement-breakpoint
-- Studentský ceník: tři položky jen pro ověřené studenty („Student do“ v kartě klienta).
-- Zatím vypnuté – Tereza odsouhlasí ceny a zapne je v Administrace → Ceník. Platnost a nastavení
-- členství přebírají z běžné permanentky „10“ a členství bez závazku; bez data prodeje = oba ceníky.
-- Jen v databázi studia (má běžné permanentky / členství) – v čerstvé databázi testů se nic nepřidá.
INSERT INTO "products" ("kind", "name", "description", "price", "entries", "validity_days", "is_active", "students_only", "sort_order")
SELECT 'pass', v.name, v.description, v.price, v.entries,
  COALESCE(v.days, (SELECT "validity_days" FROM "products" WHERE "kind" = 'pass' AND "entries" = 10 AND NOT "students_only"
    AND "archived_at" IS NULL ORDER BY "is_active" DESC, "sort_order" LIMIT 1), 90),
  false, true, 90 + v.n
FROM (VALUES
  (1, 'Studentský vstup', 'Jedna skupinová lekce za studentskou cenu.', 15000, 1, 30),
  (2, 'Studentská permanentka "10"', 'Deset vstupů na skupinové lekce za studentskou cenu.', 129000, 10, NULL)
) AS v(n, name, description, price, entries, days)
WHERE NOT EXISTS (SELECT 1 FROM "products" p WHERE p."name" = v.name)
  AND EXISTS (SELECT 1 FROM "products" WHERE "kind" = 'pass' AND NOT "students_only" AND "archived_at" IS NULL);--> statement-breakpoint
INSERT INTO "products" ("kind", "name", "description", "price", "validity_days", "weekly_limit", "recurring", "commitment_months", "is_active", "students_only", "sort_order")
SELECT 'membership', 'Studentské členství', 'Členství za studentskou cenu – bez závazku, zrušíš ho kdykoli ke konci měsíce.', 99000,
  m."validity_days", m."weekly_limit", m."recurring", 0, false, true, 90
FROM (
  SELECT * FROM "products"
  WHERE "kind" = 'membership' AND "commitment_months" = 0 AND "included_per_month" = 0
    AND NOT "students_only" AND "archived_at" IS NULL
  ORDER BY "is_active" DESC, "sale_until" DESC NULLS FIRST, "sort_order" LIMIT 1
) m
WHERE NOT EXISTS (SELECT 1 FROM "products" p WHERE p."name" = 'Studentské členství');
