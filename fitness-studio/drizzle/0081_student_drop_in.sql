ALTER TABLE "class_types" ADD COLUMN "student_drop_in_price" integer;--> statement-breakpoint
-- Studentský vstup 150 Kč u běžných skupinových lekcí (1 vstup z permanentky, úvodní vstup platí) –
-- ne Reformer, individuál ani brunch. Kupuje se u rezervace, ne jako položka ceníku.
UPDATE "class_types" SET "student_drop_in_price" = 15000
WHERE "student_drop_in_price" IS NULL AND "drop_in_price" IS NOT NULL
  AND "pass_entries" = 1 AND NOT "no_pass" AND NOT "no_free_entry";--> statement-breakpoint
UPDATE "products" SET "is_active" = false WHERE "students_only" AND "name" = 'Studentský vstup';
