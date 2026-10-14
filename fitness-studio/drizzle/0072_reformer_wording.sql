-- Členství Reformer: omezený je počet členství, ne míst.
UPDATE "products" SET "description" = replace("description", 'Omezený počet míst.', 'Omezený počet členství.')
WHERE "id" = 'b09203a4-b468-4653-be2b-01d41922d888';
