-- Úterý od 1. 12. 2026 (přání studia 23. 11. 2026): Reformer Duo se posouvá z 18:00 na 16:00 a v 18:00, po Zumba
-- Toningu, je skupinový Reformer (Reformer fusion pro 6 lidí) – do konce roku 2027 jako ostatní skupinové lekce.
-- Sobotní Duo v 7:30 zůstává. Kdo už je na úterní Duo přihlášený, dostane od studia e-mail – tady se připraví
-- jako koncept, odeslat ho musí studio. Opakované spuštění nic nezmění.

-- 1) Koncept e-mailu pro přihlášené na úterní Duo v 18:00 (jen když nějací jsou).
WITH moved AS (
  SELECT s."id" FROM "class_sessions" s
  WHERE s."class_type_id" = 'd2f6a8c4-3b17-4e59-9a0d-7c1e5b8f2a46' AND s."status"::text = 'scheduled' AND s."starts_at" > now()
    AND extract(isodow FROM s."starts_at" AT TIME ZONE 'Europe/Prague') = 2
    AND (s."starts_at" AT TIME ZONE 'Europe/Prague')::time = '18:00'
), people AS (
  SELECT DISTINCT b."user_id" FROM "bookings" b JOIN moved m ON m."id" = b."session_id"
  WHERE b."user_id" IS NOT NULL AND NOT b."is_hold" AND b."status"::text IN ('pending_payment', 'confirmed', 'waitlist')
)
INSERT INTO "campaigns" ("id", "channel", "purpose", "name", "subject", "body", "audience", "status")
SELECT '7ec83099-9eb3-46e3-86f2-b384ac170892', 'email', 'service',
  'Reformer Duo v úterý nově v 16:00',
  'Reformer Duo v úterý nově v 16:00',
  $body$Ahoj {{osloveni}},

máme pro tebe malou změnu: úterní Reformer Duo je od 1. 12. nově v 16:00–17:00. Sobotní Duo v 7:30 zůstává, jak je.

• Tvoje rezervace platí, jen v novém čase 16:00.
• Když ti 16:00 nevyhovuje, napiš nám – rezervaci zrušíme a vstup ti vrátíme, nebo tě přesuneme na jiný termín.

A novinka: v úterý v 18:00 je teď skupinový Reformer.

**Rozvrh:** https://www.octopush.fit/rozvrh

Těšíme se na tebe! 💛
Tým OCTOPUSH$body$,
  jsonb_build_object('segment', 'people', 'userIds', (SELECT jsonb_agg(p."user_id"::text) FROM people p)), 'draft'
WHERE EXISTS (SELECT 1 FROM people)
  AND NOT EXISTS (SELECT 1 FROM "campaigns" WHERE "id" = '7ec83099-9eb3-46e3-86f2-b384ac170892');
--> statement-breakpoint
-- 2) Úterní Duo z 18:00 na 16:00 (jen když ten den v 16:00 žádné Duo ještě není).
UPDATE "class_sessions" s
SET "starts_at" = ((s."starts_at" AT TIME ZONE 'Europe/Prague')::date + time '16:00') AT TIME ZONE 'Europe/Prague'
WHERE s."class_type_id" = 'd2f6a8c4-3b17-4e59-9a0d-7c1e5b8f2a46' AND s."status"::text = 'scheduled' AND s."starts_at" > now()
  AND extract(isodow FROM s."starts_at" AT TIME ZONE 'Europe/Prague') = 2
  AND (s."starts_at" AT TIME ZONE 'Europe/Prague')::time = '18:00'
  AND NOT EXISTS (
    SELECT 1 FROM "class_sessions" x
    WHERE x."class_type_id" = s."class_type_id" AND x."id" <> s."id"
      AND x."starts_at" = ((s."starts_at" AT TIME ZONE 'Europe/Prague')::date + time '16:00') AT TIME ZONE 'Europe/Prague'
  );
--> statement-breakpoint
-- 3) Skupinový Reformer v úterý 18:00 od 1. 12. 2026 do konce roku 2027: lektorka a sál jako u Reformeru, cena podle
--    ceníku dne lekce (od 1. 12. ten nový). Jen tam, kde v tu dobu na strojích nic není (žádný Reformer ani Duo).
WITH who AS (
  SELECT s."instructor_id", s."room" FROM "class_sessions" s JOIN "class_types" t ON t."id" = s."class_type_id"
  WHERE t."slug" = 'reformer-fusion' AND s."status"::text = 'scheduled' AND s."starts_at" >= '2026-12-01 00:00:00+01'
  ORDER BY s."starts_at" LIMIT 1
), dates AS (
  SELECT d::date AS "day", ((d::date)::text || ' 18:00:00')::timestamp AT TIME ZONE 'Europe/Prague' AS "starts_at"
  FROM generate_series('2026-12-01'::date, '2027-12-31'::date, interval '1 day') d
  WHERE extract(isodow FROM d) = 2
)
INSERT INTO "class_sessions" ("class_type_id", "instructor_id", "starts_at", "duration_min", "capacity", "credit_cost", "drop_in_price", "room", "series_id")
SELECT ct."id", (SELECT "instructor_id" FROM who), dates."starts_at", ct."duration_min", ct."capacity",
  CASE WHEN ct."member_surcharge_next_from" IS NOT NULL AND ct."credit_cost_next" IS NOT NULL AND dates."day"::text >= ct."member_surcharge_next_from"
    THEN ct."credit_cost_next" ELSE ct."credit_cost" END,
  CASE WHEN ct."member_surcharge_next_from" IS NOT NULL AND ct."drop_in_price_next" IS NOT NULL AND dates."day"::text >= ct."member_surcharge_next_from"
    THEN ct."drop_in_price_next" ELSE ct."drop_in_price" END,
  (SELECT "room" FROM who), '00435959-5343-479d-a531-53f841063962'::uuid
FROM dates
JOIN "class_types" ct ON ct."slug" = 'reformer-fusion' AND ct."is_active" AND ct."archived_at" IS NULL
WHERE EXISTS (SELECT 1 FROM "class_sessions" d WHERE d."class_type_id" = 'd2f6a8c4-3b17-4e59-9a0d-7c1e5b8f2a46'
    AND extract(isodow FROM d."starts_at" AT TIME ZONE 'Europe/Prague') = 2 AND (d."starts_at" AT TIME ZONE 'Europe/Prague')::time = '16:00')
  AND NOT EXISTS (SELECT 1 FROM "class_sessions" x WHERE x."series_id" = '00435959-5343-479d-a531-53f841063962')
  AND NOT EXISTS (
    SELECT 1 FROM "class_sessions" x
    WHERE x."class_type_id" IN (ct."id", 'd2f6a8c4-3b17-4e59-9a0d-7c1e5b8f2a46') AND x."status"::text <> 'cancelled'
      AND x."starts_at" < dates."starts_at" + interval '1 hour' AND x."starts_at" + make_interval(mins => x."duration_min") > dates."starts_at"
  );
--> statement-breakpoint
-- 4) Příspěvek na nástěnce „Reformer od prosince“: nové úterní časy – jen když se Duo opravdu posunulo.
UPDATE "announcements" SET "body" = replace(replace("body",
    'Termíny: pondělí 6:00, středa 17:00, pátek 6:30 a neděle 17:00.', 'Termíny: pondělí 6:00, úterý 18:00, středa 17:00, pátek 6:30 a neděle 17:00.'),
    'Termíny: úterý 18:00 a sobota 7:30.', 'Termíny: úterý 16:00 a sobota 7:30.')
WHERE "id" = 'a8e3c5d1-6f24-4b97-8c0e-2d71b4f9e635' AND "body" LIKE '%Termíny: úterý 18:00 a sobota 7:30.%'
  AND EXISTS (SELECT 1 FROM "class_sessions" WHERE "series_id" = '00435959-5343-479d-a531-53f841063962');
