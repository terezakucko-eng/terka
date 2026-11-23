-- Reformer fusion: první lekce zdarma jako na ostatní lekce (přání studia 23. 11. 2026). Úvodní vstup zdarma na ni
-- nově jde použít a první lekce už nestojí 200 Kč. Reformer Duo zůstává bez úvodního vstupu (hodina jen pro dva).
-- Ceník a stránky lekcí si text složí samy. Jen jednou – co si studio mezitím nastavilo, zůstává.
UPDATE "class_types" SET "no_free_entry" = false, "first_visit_price" = NULL, "first_visit_new_only" = false
WHERE "slug" = 'reformer-fusion' AND "no_free_entry" AND "first_visit_price" = 20000;
--> statement-breakpoint
-- Budoucí běžné termíny (bez vlastního názvu), kdyby měly zákaz vstupu zdarma u sebe; speciální akce zůstávají.
UPDATE "class_sessions" s SET "no_free_entry" = false
FROM "class_types" ct
WHERE ct."id" = s."class_type_id" AND ct."slug" = 'reformer-fusion' AND NOT ct."no_free_entry"
  AND s."no_free_entry" AND s."status"::text = 'scheduled' AND s."starts_at" > now() AND coalesce(s."title", '') = '';
