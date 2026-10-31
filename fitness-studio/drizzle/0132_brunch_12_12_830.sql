-- Barre + Brunch on 12 Dec 2026 runs 8:30–11:00, not 9:30–11:00: the session 0131 made starts an hour earlier
-- and takes 150 minutes. Only that one, and not if there's already a brunch at 8:30.
UPDATE "class_sessions" s SET "starts_at" = '2026-12-12 08:30:00+01', "duration_min" = 150
FROM "class_types" ct
WHERE ct."id" = s."class_type_id" AND ct."slug" = 'fitness-brunch'
  AND s."starts_at" = '2026-12-12 09:30:00+01' AND s."status"::text <> 'cancelled'
  AND NOT EXISTS (
    SELECT 1 FROM "class_sessions" y
    WHERE y."class_type_id" = ct."id" AND y."starts_at" = '2026-12-12 08:30:00+01' AND y."status"::text <> 'cancelled'
  );
