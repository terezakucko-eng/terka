-- Barre on its own, without the brunch: a regular lesson from the ready-made draft – 55 minutes, 8 places (a barre
-- each), priced like the studio's usual group lesson (credits, drop-in and student price copied from the active
-- lesson with the most classes in the last two months – not Reformer, a brunch or one with its own rules).
-- If Barre is already there (a draft switched off, or archived), it's just switched on and keeps what it has.
WITH "std" AS (
  SELECT ct."credit_cost", ct."drop_in_price", ct."student_drop_in_price", ct."sort_order"
  FROM "class_types" ct
  LEFT JOIN "class_sessions" s ON s."class_type_id" = ct."id" AND s."starts_at" > now() - interval '60 days' AND s."status"::text <> 'cancelled'
  WHERE ct."is_active" AND ct."archived_at" IS NULL AND ct."drop_in_price" IS NOT NULL AND NOT ct."no_pass"
    AND ct."slug" NOT LIKE '%reformer%' AND ct."slug" NOT LIKE '%brunch%' AND ct."slug" NOT LIKE '%individual%'
    AND ct."member_surcharge" IS NULL AND ct."pass_surcharge" IS NULL
  GROUP BY ct."id"
  ORDER BY count(s."id") DESC, ct."sort_order"
  LIMIT 1
)
INSERT INTO "class_types" ("name", "slug", "description", "keywords", "level", "duration_min", "capacity", "credit_cost", "drop_in_price", "student_drop_in_price", "color", "is_active", "sort_order")
SELECT 'Barre', 'barre',
  'Spojení baletu, pilates a posilování u tyče. Drobné přesné pohyby zpevní hýždě, stehna a střed těla a vytvarují postavu. Baletní průprava není potřeba.',
  'barre Ostrava, barre workout, balet fitness, tvarování postavy',
  'Pro všechny', 55, 8,
  COALESCE((SELECT "credit_cost" FROM "std"), 1),
  (SELECT "drop_in_price" FROM "std"),
  (SELECT "student_drop_in_price" FROM "std"),
  '#D98BA6', true,
  COALESCE((SELECT "sort_order" FROM "std"), 0)
WHERE NOT EXISTS (SELECT 1 FROM "class_types" WHERE "slug" = 'barre' OR lower("name") = 'barre');
--> statement-breakpoint
UPDATE "class_types" SET "is_active" = true, "archived_at" = NULL
WHERE ("slug" = 'barre' OR lower("name") = 'barre') AND (NOT "is_active" OR "archived_at" IS NOT NULL);
