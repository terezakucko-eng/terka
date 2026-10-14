-- Členství Reformer: předprodej jako u Členství 2027 (koupit jde hned, platí od 1. 1. 2027), 4 členství – kdo dřív přijde, ten dřív mele.
-- Členky na něj dál přecházejí v Můj účet.
UPDATE "products" SET "presale_from" = now(), "max_active" = 4
WHERE "id" = 'b09203a4-b468-4653-be2b-01d41922d888' AND "presale_from" IS NULL;
