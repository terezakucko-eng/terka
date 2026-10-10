-- Fitness brunch: the 200 Kč first-lesson price only for newcomers (no class at the studio yet), not for everyone's first brunch.
UPDATE "class_types" SET "first_visit_new_only" = true WHERE "slug" = 'fitness-brunch';
