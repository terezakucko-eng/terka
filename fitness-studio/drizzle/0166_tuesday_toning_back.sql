-- Úterní Zumba Toning zpátky (17. 11. 2026). Studio měnilo sobotní Zumba Toning na Barre volbou „Tuhle a všechny
-- další v opakování“ – úterky a soboty ale sdílely jedno opakování, takže se změnily i úterky (od 1. 12. byly
-- v sobotním čase 8:30, část z nich jako Barre). Kód už mění jen lekce ve stejný den v týdnu.
-- Úterní termíny opakování po 24. 11. dostanou zpátky všechno podle úterý 24. 11. (Zumba Toning 17:00–17:45,
-- lektorka, místa, cena, sál…). Jen ty, které se od něj liší lekcí nebo časem, a ne když v ten čas už Zumba Toning je.

-- 1) Kdo je na posunutých úterních lekcích přihlášený, dostane omluvu – jako koncept, odeslat ho musí studio.
WITH ref AS (
  SELECT r.* FROM "class_sessions" r WHERE r."id" = '43677e69-20fb-49ad-8df2-125a1df6cada' AND r."series_id" IS NOT NULL
), wrong AS (
  SELECT s."id" FROM "class_sessions" s, ref r
  WHERE s."series_id" = r."series_id" AND s."starts_at" > r."starts_at" AND s."status"::text = 'scheduled'
    AND extract(isodow FROM s."starts_at" AT TIME ZONE 'Europe/Prague') = extract(isodow FROM r."starts_at" AT TIME ZONE 'Europe/Prague')
    AND (s."class_type_id" <> r."class_type_id"
      OR (s."starts_at" AT TIME ZONE 'Europe/Prague')::time <> (r."starts_at" AT TIME ZONE 'Europe/Prague')::time)
), people AS (
  SELECT DISTINCT b."user_id" FROM "bookings" b JOIN wrong w ON w."id" = b."session_id"
  WHERE b."user_id" IS NOT NULL AND NOT b."is_hold" AND b."status"::text IN ('pending_payment', 'confirmed', 'waitlist')
)
INSERT INTO "campaigns" ("id", "channel", "purpose", "name", "subject", "body", "audience", "status")
SELECT '6a378e00-6fc8-417e-9cc0-ba359566afc0', 'email', 'service',
  'Úterní Zumba Toning zůstává v 17:00',
  'Úterní Zumba Toning zůstává v 17:00',
  $body$Ahoj {{osloveni}},

moc se omlouváme, v rozvrhu se nám spletly úterní lekce. Úterní Zumba Toning se nepřesouvá na 8:30 ani nemění na Barre – zůstává jako vždycky v 17:00–17:45.

• Tvoje rezervace platí, nic dalšího dělat nemusíš.
• Když ti 17:00 nevyhovuje, napiš nám a domluvíme se.

**Rozvrh:** https://www.octopush.fit/rozvrh

Těšíme se na tebe v úterý v 17:00! 💛
Tým OCTOPUSH$body$,
  jsonb_build_object('segment', 'people', 'userIds', (SELECT jsonb_agg(p."user_id"::text) FROM people p)), 'draft'
WHERE EXISTS (SELECT 1 FROM people)
  AND NOT EXISTS (SELECT 1 FROM "campaigns" WHERE "id" = '6a378e00-6fc8-417e-9cc0-ba359566afc0');
--> statement-breakpoint
-- 2) Úterky zpátky podle 24. 11.: Zumba Toning v 17:00, se vším, co k ní patří. Cena podle ceníku dne lekce
--    (kdyby měla Zumba Toning od nějakého data nový ceník), jinak jako 24. 11.
UPDATE "class_sessions" s SET
  "class_type_id" = r."class_type_id", "instructor_id" = r."instructor_id", "duration_min" = r."duration_min",
  "capacity" = r."capacity",
  "credit_cost" = CASE WHEN ct."member_surcharge_next_from" IS NOT NULL AND ct."credit_cost_next" IS NOT NULL
      AND to_char(s."starts_at" AT TIME ZONE 'Europe/Prague', 'YYYY-MM-DD') >= ct."member_surcharge_next_from" AND r."credit_cost" = ct."credit_cost"
    THEN ct."credit_cost_next" ELSE r."credit_cost" END,
  "drop_in_price" = CASE WHEN ct."member_surcharge_next_from" IS NOT NULL AND ct."drop_in_price_next" IS NOT NULL
      AND to_char(s."starts_at" AT TIME ZONE 'Europe/Prague', 'YYYY-MM-DD') >= ct."member_surcharge_next_from" AND r."drop_in_price" = ct."drop_in_price"
    THEN ct."drop_in_price_next" ELSE r."drop_in_price" END,
  "is_free" = r."is_free", "no_free_entry" = r."no_free_entry", "drop_in_only" = r."drop_in_only", "ribbon" = r."ribbon",
  "room" = r."room", "title" = r."title", "note" = r."note", "booking_opens_at" = r."booking_opens_at",
  "starts_at" = ((s."starts_at" AT TIME ZONE 'Europe/Prague')::date + (r."starts_at" AT TIME ZONE 'Europe/Prague')::time) AT TIME ZONE 'Europe/Prague'
FROM "class_sessions" r
JOIN "class_types" ct ON ct."id" = r."class_type_id"
WHERE r."id" = '43677e69-20fb-49ad-8df2-125a1df6cada' AND r."series_id" IS NOT NULL
  AND s."series_id" = r."series_id" AND s."starts_at" > r."starts_at" AND s."status"::text = 'scheduled'
  AND extract(isodow FROM s."starts_at" AT TIME ZONE 'Europe/Prague') = extract(isodow FROM r."starts_at" AT TIME ZONE 'Europe/Prague')
  AND (s."class_type_id" <> r."class_type_id"
    OR (s."starts_at" AT TIME ZONE 'Europe/Prague')::time <> (r."starts_at" AT TIME ZONE 'Europe/Prague')::time)
  AND NOT EXISTS (
    SELECT 1 FROM "class_sessions" x
    WHERE x."id" <> s."id" AND x."class_type_id" = r."class_type_id" AND x."status"::text = 'scheduled'
      AND x."starts_at" = ((s."starts_at" AT TIME ZONE 'Europe/Prague')::date + (r."starts_at" AT TIME ZONE 'Europe/Prague')::time) AT TIME ZONE 'Europe/Prague'
  );
