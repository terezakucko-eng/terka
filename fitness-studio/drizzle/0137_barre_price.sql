-- Barre was already there as an unfinished draft, so 0135 only switched it on – with the default 1 credit and no
-- drop-in price. Priced now like the studio's usual group lesson (the same pick as 0135: credits, drop-in and
-- student price of the active lesson with the most classes in the last two months – not Reformer, a brunch or one
-- with its own rules), but only while Barre has no drop-in price of its own. Its coming classes that have no
-- drop-in price yet (the one on 5 Nov) take the new price too.
WITH "std" AS (
  SELECT ct."credit_cost", ct."drop_in_price", ct."student_drop_in_price"
  FROM "class_types" ct
  LEFT JOIN "class_sessions" s ON s."class_type_id" = ct."id" AND s."starts_at" > now() - interval '60 days' AND s."status"::text <> 'cancelled'
  WHERE ct."is_active" AND ct."archived_at" IS NULL AND ct."drop_in_price" IS NOT NULL AND NOT ct."no_pass"
    AND ct."slug" NOT LIKE '%reformer%' AND ct."slug" NOT LIKE '%brunch%' AND ct."slug" NOT LIKE '%individual%'
    AND ct."slug" NOT LIKE '%barre%'
    AND ct."member_surcharge" IS NULL AND ct."pass_surcharge" IS NULL
  GROUP BY ct."id" ORDER BY count(s."id") DESC, ct."sort_order" LIMIT 1
)
UPDATE "class_types" b
SET "credit_cost" = "std"."credit_cost", "drop_in_price" = "std"."drop_in_price",
    "student_drop_in_price" = coalesce(b."student_drop_in_price", "std"."student_drop_in_price")
FROM "std"
WHERE (b."slug" = 'barre' OR lower(b."name") = 'barre') AND b."drop_in_price" IS NULL;
--> statement-breakpoint
UPDATE "class_sessions" s
SET "credit_cost" = ct."credit_cost", "drop_in_price" = ct."drop_in_price"
FROM "class_types" ct
WHERE s."class_type_id" = ct."id" AND (ct."slug" = 'barre' OR lower(ct."name") = 'barre')
  AND ct."drop_in_price" IS NOT NULL AND s."drop_in_price" IS NULL AND NOT s."is_free"
  AND s."starts_at" > now() AND s."status"::text <> 'cancelled';
