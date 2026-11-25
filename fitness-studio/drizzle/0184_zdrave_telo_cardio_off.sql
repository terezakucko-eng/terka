-- Zdravé tělo | cardio trénink (na fotce „Zdravé tělo II“) končí – přání studia 25. 11. 2026: na webu zůstává jen
-- Zdravé tělo | silový trénink. Lekce zmizí ze stránky Lekce a z rozvrhu zmizí její budoucí termíny, na které nikdo
-- není přihlášený. Termín, kde už někdo je, zůstává – zrušit ho musí studio v administraci (vrátí vstupy a pošle e-mail).
-- Vrátit jde zaškrtnutím „Aktivní“ u lekce v administraci. Opakované spuštění nic nezmění.

-- 1) Prázdné budoucí termíny lekce se zruší (vlastní akce s nadpisem zůstávají).
UPDATE "class_sessions" s SET "status" = 'cancelled'
FROM "class_types" ct
WHERE ct."id" = s."class_type_id" AND ct."name" ILIKE 'Zdravé tělo%cardio%'
  AND s."starts_at" > now() AND s."status"::text = 'scheduled' AND coalesce(s."title", '') = ''
  AND NOT EXISTS (SELECT 1 FROM "bookings" b WHERE b."session_id" = s."id" AND b."status"::text <> 'cancelled');
--> statement-breakpoint
-- 2) Lekce se skryje z webu.
UPDATE "class_types" SET "is_active" = false
WHERE "name" ILIKE 'Zdravé tělo%cardio%' AND "is_active";
