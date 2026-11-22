-- Reformer fusion a Reformer Duo: do popisu lekce (stránka lekce i termíny v rozvrhu) tip na protiskluzové ponožky
-- a že se dají koupit na recepci (přání studia 22. 11. 2026). Jen jednou – když tam o nich ještě nic není.
UPDATE "class_types" SET "description" = CASE
    WHEN btrim("description") = '' THEN 'Doporučujeme protiskluzové ponožky – když je nemáš, koupíš si je u nás na recepci. 🧦'
    ELSE rtrim("description") || ' Doporučujeme protiskluzové ponožky – když je nemáš, koupíš si je u nás na recepci. 🧦'
  END
WHERE "slug" IN ('reformer-fusion', 'reformer-duo') AND "description" NOT ILIKE '%protiskluz%';
