-- First Fitness brunch (Sat 31 Oct 2026, 8:30) is Barre, not Zumba Toning; the brunch takes 8 people, not 10.
UPDATE "class_sessions" SET "capacity" = 8, "title" = 'Barre + Brunch'
WHERE "id" = '3f3a2507-1b0e-48c3-a9d8-d7d0afc7a21c';
--> statement-breakpoint
UPDATE "class_sessions" SET "capacity" = 8
WHERE "class_type_id" IN (SELECT "id" FROM "class_types" WHERE "slug" = 'fitness-brunch')
  AND "status" = 'scheduled' AND "starts_at" > now() AND "capacity" = 10;
--> statement-breakpoint
UPDATE "class_types"
SET "capacity" = 8, "description" = replace("description", 'Jen 10 míst', 'Jen 8 míst')
WHERE "slug" = 'fitness-brunch';
