-- Skupinový Reformer (Reformer fusion) pro 6 lidí místo 5 (přání studia 22. 11. 2026): lekce i všechny budoucí
-- termíny, které ještě mají 5 míst, a text na nástěnce. Co si studio nastavilo jinak, zůstává. Náhradníky na nová
-- místa posune cron (uvolněná místa u Reformeru) a dá jim vědět e-mailem.
UPDATE "class_types" SET "capacity" = 6
WHERE "slug" = 'reformer-fusion' AND "capacity" = 5;
--> statement-breakpoint
UPDATE "class_sessions" s SET "capacity" = 6
FROM "class_types" ct
WHERE ct."id" = s."class_type_id" AND ct."slug" = 'reformer-fusion' AND ct."capacity" = 6
  AND s."status"::text = 'scheduled' AND s."starts_at" > now() AND s."capacity" = 5;
--> statement-breakpoint
UPDATE "announcements" SET "body" = replace("body", 'nejvýš 5 lidí', 'nejvýš 6 lidí')
WHERE "id" = 'a8e3c5d1-6f24-4b97-8c0e-2d71b4f9e635' AND "body" LIKE '%nejvýš 5 lidí%'
  AND EXISTS (SELECT 1 FROM "class_types" WHERE "slug" = 'reformer-fusion' AND "capacity" = 6);
