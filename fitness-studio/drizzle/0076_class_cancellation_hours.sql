ALTER TABLE "class_types" ADD COLUMN "cancellation_hours" integer;--> statement-breakpoint
-- Reformer a brunch: storno zdarma do 24 h před lekcí (ostatní lekce dál podle Nastavení).
UPDATE "class_types" SET "cancellation_hours" = 24
WHERE ("slug" LIKE '%reformer%' OR "slug" LIKE '%brunch%') AND "cancellation_hours" IS NULL;--> statement-breakpoint
-- Upravené texty na webu a v e-mailech: k lhůtě pro storno doplnit výjimky. Rovnou jako text, ne {{storno_vyjimky}}:
-- migrace běží už při buildu náhledu a web před sloučením by neznámý zástupný text ukázal doslova.
UPDATE "content" SET "value" = replace(replace(replace(replace("value",
  '{{storno_hodin}} h před lekcí', '{{storno_hodin}} h před lekcí (u lekcí Reformer fusion a Fitness brunch 24 h)'),
  '{{storno_hodin}} h před začátkem lekce', '{{storno_hodin}} h před začátkem lekce (u lekcí Reformer fusion a Fitness brunch 24 h)'),
  '{{storno_hodin}} hodin před začátkem lekce', '{{storno_hodin}} hodin před začátkem lekce (u lekcí Reformer fusion a Fitness brunch 24 h)'),
  'lekce zrušená později než {{storno_hodin}} hodin předem', 'lekce zrušená po lhůtě pro storno zdarma')
WHERE "value" LIKE '%{{storno_hodin}}%' AND "value" NOT LIKE '%Fitness brunch 24 h%' AND "value" NOT LIKE '%{{storno_vyjimky}}%';
