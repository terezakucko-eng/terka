-- Fitness brunch with a pass: 1 entry + 170 Kč surcharge for the treats (members pay 150 Kč, so they keep the better deal).
UPDATE "class_types"
SET "no_pass" = false, "pass_entries" = 1, "pass_surcharge" = 17000
WHERE "slug" = 'fitness-brunch';
