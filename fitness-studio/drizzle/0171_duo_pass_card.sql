-- Reformer Duo: lekce zdarma z kartičky Pošli to dál na něj nově platí, stejně jako na Reformer fusion (přání studia
-- 23. 11. 2026) – kartička je pozvánka pro kamarádku a Duo je hodina právě pro dva. Úvodní vstup zdarma pro nováčky
-- na Duo dál neplatí. Jen dokud to studio nenastavilo samo.
UPDATE "class_types" SET "pass_card_entry" = true
WHERE "id" = 'd2f6a8c4-3b17-4e59-9a0d-7c1e5b8f2a46' AND NOT "pass_card_entry";
