-- Reformer od 1. 12. 2026 (rozhodnutí studia 16. 11. 2026): nový ceník platí už od prosince, lekce pro dva se jmenuje
-- Reformer Duo a běží v úterý 18:00 a v sobotu 7:30. Skupinové lekce (po 6:00, st 17:00, pá 6:30, ne 17:00) už v rozvrhu jsou.
-- Členství Reformer a dárkové Reformery platí dál od 1. 1. 2027.
-- Všechno je hlídané na hodnoty z migrace 0159: co si studio mezitím upravilo v administraci, zůstává. Opakované spuštění nic nezmění.

-- 1) Nový ceník Reformer fusion od 1. 12. 2026 (390 Kč / 340 kreditů, permanentka 1 vstup + 100 Kč, členové 120 Kč) –
--    a do té doby u lekce i v ceníku poznámka, že od prosince bude levnější.
UPDATE "class_types" SET
  "member_surcharge_next_from" = '2026-12-01',
  "price_note" = CASE WHEN coalesce("price_note", '') = '' THEN 'Od 1. 12. 2026 za 390 Kč' ELSE "price_note" END,
  "price_note_until" = CASE WHEN coalesce("price_note", '') = '' THEN '2026-12-01' ELSE "price_note_until" END
WHERE "slug" = 'reformer-fusion' AND "member_surcharge_next_from" = '2027-01-01'
  AND "member_surcharge_next" = 12000 AND "drop_in_price_next" = 39000 AND "credit_cost_next" = 340;
--> statement-breakpoint
-- Prosincové termíny, na kterých zatím nikdo není: cena z nového ceníku. Kde už někdo je, cena zůstává (vratky se počítají z ní).
UPDATE "class_sessions" s SET "drop_in_price" = ct."drop_in_price_next", "credit_cost" = ct."credit_cost_next"
FROM "class_types" ct
WHERE ct."id" = s."class_type_id" AND ct."slug" = 'reformer-fusion' AND ct."member_surcharge_next_from" = '2026-12-01'
  AND ct."drop_in_price_next" = 39000 AND ct."credit_cost_next" = 340
  AND s."starts_at" >= '2026-12-01 00:00:00+01' AND s."starts_at" < '2027-01-01 00:00:00+01' AND s."status"::text = 'scheduled'
  AND s."drop_in_price" = ct."drop_in_price" AND s."credit_cost" = ct."credit_cost"
  AND NOT EXISTS (SELECT 1 FROM "bookings" b WHERE b."session_id" = s."id" AND b."status"::text <> 'cancelled');
--> statement-breakpoint
-- …a pro 5 lidí, pokud jich tam už není víc.
UPDATE "class_sessions" s SET "capacity" = 5
FROM "class_types" ct
WHERE ct."id" = s."class_type_id" AND ct."slug" = 'reformer-fusion' AND ct."capacity" = 5 AND ct."member_surcharge_next_from" = '2026-12-01'
  AND s."starts_at" >= '2026-12-01 00:00:00+01' AND s."starts_at" < '2027-01-01 00:00:00+01' AND s."status"::text = 'scheduled' AND s."capacity" = 6
  AND (SELECT coalesce(sum(b."seats"), 0) FROM "bookings" b WHERE b."session_id" = s."id" AND b."status"::text <> 'cancelled') <= 5;
--> statement-breakpoint
-- 2) Lekce pro dva se jmenuje Reformer Duo (stará adresa /lekce/reformer-fusion-ve-dvou přesměruje na novou).
UPDATE "class_types" SET
  "name" = 'Reformer Duo', "slug" = 'reformer-duo',
  "description" = replace("description", 'Reformer jen pro dva.', 'Reformer Duo je hodina jen pro dva.'),
  "keywords" = 'reformer duo Ostrava, reformer pro dva, reformer ve dvou, pilates reformer Ostrava, reformer s individuálním přístupem',
  "price_note" = CASE WHEN "price_note" = 'Nově od ledna 2027' THEN 'Novinka od 1. 12. 2026' ELSE "price_note" END,
  "price_note_until" = CASE WHEN "price_note" = 'Nově od ledna 2027' THEN '2026-12-01' ELSE "price_note_until" END
WHERE "id" = 'd2f6a8c4-3b17-4e59-9a0d-7c1e5b8f2a46' AND "name" = 'Reformer fusion ve dvou'
  AND NOT EXISTS (SELECT 1 FROM "class_types" x WHERE x."slug" = 'reformer-duo');
--> statement-breakpoint
-- 3) Termíny Reformer Duo: úterý 18:00 a sobota 7:30 od 1. 12. 2026 do konce roku 2027 (jako skupinové lekce),
--    lektorka a sál jako u Reformeru. Dvě řady (jedna na den), aby šly upravovat každá zvlášť. Kde už v tu dobu
--    nějaký termín Reformer Duo je (i zrušený), nový nevznikne.
WITH who AS (
  SELECT s."instructor_id", s."room" FROM "class_sessions" s JOIN "class_types" t ON t."id" = s."class_type_id"
  WHERE t."slug" = 'reformer-fusion' AND s."status"::text = 'scheduled' AND s."starts_at" >= '2026-12-01 00:00:00+01'
  ORDER BY s."starts_at" LIMIT 1
), slot("dow", "hhmm", "series") AS (
  VALUES (2, '18:00', '68d89a26-3776-44d5-acf8-726e393157a6'::uuid), (6, '07:30', '7a9e1654-7119-4077-8506-67dae9762456'::uuid)
), dates AS (
  SELECT slot."series", ((d::date)::text || ' ' || slot."hhmm" || ':00')::timestamp AT TIME ZONE 'Europe/Prague' AS "starts_at"
  FROM generate_series('2026-12-01'::date, '2027-12-31'::date, interval '1 day') d
  JOIN slot ON extract(isodow FROM d) = slot."dow"
)
INSERT INTO "class_sessions" ("class_type_id", "instructor_id", "starts_at", "duration_min", "capacity", "credit_cost", "drop_in_price", "room", "series_id")
SELECT ct."id", (SELECT "instructor_id" FROM who), dates."starts_at", ct."duration_min", ct."capacity", ct."credit_cost", ct."drop_in_price",
  (SELECT "room" FROM who), dates."series"
FROM dates
JOIN "class_types" ct ON ct."id" = 'd2f6a8c4-3b17-4e59-9a0d-7c1e5b8f2a46' AND ct."name" = 'Reformer Duo' AND ct."is_active" AND ct."archived_at" IS NULL
WHERE NOT EXISTS (SELECT 1 FROM "class_sessions" x WHERE x."class_type_id" = ct."id" AND x."starts_at" = dates."starts_at")
  AND NOT EXISTS (SELECT 1 FROM "class_sessions" x WHERE x."series_id" = dates."series");
--> statement-breakpoint
-- 4) Texty: Reformer Duo a ceny od prosince – jen když je lekce přejmenovaná a text ještě neupravený.
UPDATE "products" SET "description" = replace("description", '(lekce ve dvou se počítá za dvě)', '(Reformer Duo se počítá za dvě)')
WHERE "id" = 'b09203a4-b468-4653-be2b-01d41922d888' AND "description" LIKE '%(lekce ve dvou se počítá za dvě)%'
  AND EXISTS (SELECT 1 FROM "class_types" WHERE "slug" = 'reformer-duo');
--> statement-breakpoint
UPDATE "announcements" SET "body" = replace("body", 'skupinová lekce i nová lekce ve dvou (ta se počítá za dvě)', 'skupinová lekce i nový Reformer Duo (ten se počítá za dvě)')
WHERE "id" = '1dd44d7a-151f-4695-8a47-a11e64aa898f' AND "body" LIKE '%nová lekce ve dvou (ta se počítá za dvě)%'
  AND EXISTS (SELECT 1 FROM "class_types" WHERE "slug" = 'reformer-duo');
--> statement-breakpoint
UPDATE "announcements" SET "body" = replace(replace("body", 'na lekci ve dvou dvě', 'na Reformer Duo dvě'), 'lekce ve dvou 240 Kč', 'Reformer Duo 240 Kč')
WHERE "id" = 'ec9596c8-12e0-4cf2-97ff-d54610740a2d' AND "body" LIKE '%lekce ve dvou 240 Kč%'
  AND EXISTS (SELECT 1 FROM "class_types" WHERE "slug" = 'reformer-duo');
--> statement-breakpoint
UPDATE "campaigns" SET "body" = replace(replace("body", 'na lekci ve dvou dvě', 'na Reformer Duo dvě'), 'lekce ve dvou 240 Kč', 'Reformer Duo 240 Kč')
WHERE "id" = '1b19f3f2-85a4-450e-a725-1e2a51640f4f' AND "status"::text = 'draft' AND "body" LIKE '%lekce ve dvou 240 Kč%'
  AND EXISTS (SELECT 1 FROM "class_types" WHERE "slug" = 'reformer-duo');
--> statement-breakpoint
-- Příspěvek o novinkách (z migrace 0159): od prosince, Reformer Duo, termíny – jen dokud ho studio neupravilo.
UPDATE "announcements" SET
  "title" = '🧘‍♀️ Reformer od prosince: levněji a nově Reformer Duo',
  "body" = $body$<p>Reformer vypadá jako mučidlo, ale odcházíš z něj jako znovuzrozená. Od 1. 12. 2026 se na něj dostaneš levněji a máme pro tebe i novinku. 💛</p>
<h3>Skupinová lekce – 390 Kč</h3>
<ul>
<li>Jednorázově 390 Kč (místo 490 Kč) nebo 340 kreditů.</li>
<li>S permanentkou 1 vstup + doplatek 100 Kč.</li>
<li>Členové doplácí 120 Kč.</li>
<li>Cvičíme v malé skupině, nejvýš 5 lidí, takže si tě lektorka všimne pořád.</li>
<li>Termíny: pondělí 6:00, středa 17:00, pátek 6:30 a neděle 17:00.</li>
</ul>
<h3>✨ Novinka: Reformer Duo – 490 Kč</h3>
<p>Celá hodina jen pro dva. Lektorka se věnuje jen vám, každý pohyb doladí na míru a rozdíl ucítíš hned. Vezmi kamarádku, mámu nebo partnera, nebo přijď sama a poznej nového parťáka na stroji vedle.</p>
<ul>
<li>Jednorázově 490 Kč na osobu nebo 430 kreditů.</li>
<li>S permanentkou 2 vstupy.</li>
<li>Členové doplácí 240 Kč.</li>
<li>Termíny: úterý 18:00 a sobota 7:30.</li>
</ul>
<h3>Členství Reformer – od ledna 2 300 Kč měsíčně</h3>
<ul>
<li>8× Reformer měsíčně v ceně: skupinová lekce se počítá za jednu, Reformer Duo za dvě.</li>
<li>Přednostní rezervace Reformeru a vše z klasického členství.</li>
<li>Už ho máš zarezervované? I tobě platí nová cena 2 300 Kč.</li>
</ul>
<p><a href="/rozvrh?tyden=2026-11-30">👉 Prosincové termíny v rozvrhu</a></p>
<p><a href="/cenik">👉 Ceník</a></p>$body$
WHERE "id" = 'a8e3c5d1-6f24-4b97-8c0e-2d71b4f9e635' AND "title" = '🧘‍♀️ Reformer od ledna: levněji a nově i ve dvou'
  AND "body" LIKE '%Termíny: úterý 18:00, středa 17:00, pátek 6:30 a sobota 7:30.%'
  AND EXISTS (SELECT 1 FROM "class_types" WHERE "slug" = 'reformer-duo')
  AND EXISTS (SELECT 1 FROM "class_types" WHERE "slug" = 'reformer-fusion' AND "member_surcharge_next_from" = '2026-12-01');
