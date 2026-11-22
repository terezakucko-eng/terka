-- Reformer fusion: štítek „Basic“ (přání studia 22. 11. 2026). Úroveň lekce se ukazuje na stránce lekce, u termínu
-- a nově jako štítek v rozvrhu (u lekcí, které nejsou „Pro všechny“). Jen když ji studio ještě neměnilo.
UPDATE "class_types" SET "level" = 'Basic'
WHERE "slug" = 'reformer-fusion' AND "level" = 'Pro všechny';
