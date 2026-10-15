-- Studentské ceny odsouhlasené Terezou (15. 10. 2026): vstup 150 Kč, permanentka „10“ 1 290 Kč, členství 990 Kč/měsíc – zapnout.
UPDATE "products" SET "is_active" = true
WHERE "students_only" AND "archived_at" IS NULL
  AND "name" IN ('Studentský vstup', 'Studentská permanentka "10"', 'Studentské členství');
