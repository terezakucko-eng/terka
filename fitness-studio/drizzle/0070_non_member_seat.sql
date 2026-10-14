ALTER TABLE "class_types" ADD COLUMN "non_member_seats" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "class_types" ADD COLUMN "non_member_release_hours" integer DEFAULT 168 NOT NULL;--> statement-breakpoint
-- Reformer: jedno místo z šesti drží web pro nečlenky (permanentka, kredit, jednorázově, první lekce) – členky ho můžou vzít až týden před lekcí.
UPDATE "class_types" SET "non_member_seats" = 1, "non_member_release_hours" = 168 WHERE "slug" = 'reformer-fusion';
