-- Skupinový Reformer už v úterý 24. 11. 2026 v 18:00, po Zumba Toningu (přání studia 23. 11. 2026) – o týden dřív,
-- než začne úterní řada od 1. 12. (migrace 0172). Patří do stejné řady, takže „tento a následující“ v administraci
-- vezme i jeho. Lektorka, sál, délka a místa jako u úterního Reformeru, cena podle ceníku dne lekce (listopadového).
-- Jen když úterní řada existuje a stroje jsou v tu dobu volné. Opakované spuštění nic nezmění.
WITH src AS (
  SELECT s."instructor_id", s."room", s."duration_min", s."capacity" FROM "class_sessions" s
  WHERE s."series_id" = '00435959-5343-479d-a531-53f841063962' AND s."status"::text = 'scheduled'
  ORDER BY s."starts_at" LIMIT 1
), slot AS (
  SELECT '2026-11-24 18:00:00+01'::timestamptz AS "starts_at", '2026-11-24' AS "day"
)
INSERT INTO "class_sessions" ("id", "class_type_id", "instructor_id", "starts_at", "duration_min", "capacity", "credit_cost", "drop_in_price", "room", "series_id")
SELECT '295a46a8-a154-4d21-b739-f2c4beb5598c', ct."id", src."instructor_id", slot."starts_at", src."duration_min", src."capacity",
  CASE WHEN ct."member_surcharge_next_from" IS NOT NULL AND ct."credit_cost_next" IS NOT NULL AND slot."day" >= ct."member_surcharge_next_from"
    THEN ct."credit_cost_next" ELSE ct."credit_cost" END,
  CASE WHEN ct."member_surcharge_next_from" IS NOT NULL AND ct."drop_in_price_next" IS NOT NULL AND slot."day" >= ct."member_surcharge_next_from"
    THEN ct."drop_in_price_next" ELSE ct."drop_in_price" END,
  src."room", '00435959-5343-479d-a531-53f841063962'::uuid
FROM src, slot
JOIN "class_types" ct ON ct."slug" = 'reformer-fusion' AND ct."is_active" AND ct."archived_at" IS NULL
WHERE NOT EXISTS (SELECT 1 FROM "class_sessions" x WHERE x."id" = '295a46a8-a154-4d21-b739-f2c4beb5598c')
  AND NOT EXISTS (
    SELECT 1 FROM "class_sessions" x
    WHERE x."class_type_id" IN (ct."id", 'd2f6a8c4-3b17-4e59-9a0d-7c1e5b8f2a46') AND x."status"::text <> 'cancelled'
      AND x."starts_at" < slot."starts_at" + make_interval(mins => src."duration_min")
      AND x."starts_at" + make_interval(mins => x."duration_min") > slot."starts_at"
  );
