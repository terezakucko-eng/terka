-- Členství Reformer 2027 – varianta B (pro klientky): 8× Reformer fusion měsíčně v ceně, nejvýš 3 členství. Pořád skryté, zapíná se po sloučení.
UPDATE "products" SET
  "included_per_month" = 8, "max_active" = 3,
  "description" = 'Vše z členství, 8× Reformer fusion měsíčně v ceně a přednostní rezervace Reformeru. Omezený počet míst.'
WHERE "id" = 'b09203a4-b468-4653-be2b-01d41922d888' AND NOT "is_active";
