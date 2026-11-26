-- Neděle 29. 11. 2026 v 18:00 (přání studia 26. 11. 2026): Zumba fitness s hostující lektorkou Kristou Světnickou –
-- Kikinou – spolu s Terezou. V rozvrhu se lekce jmenuje „Zumba fitness s Kikinou“ a na nástěnce je o ní připnutý
-- příspěvek s odkazem na rezervaci. Rezervuje se a platí jako každá Zumba fitness. Opakované spuštění nic nezmění.

-- 1) Když v tu dobu ještě žádná Zumba (kromě Toningu) v rozvrhu není, založí se (délka, místa a cena podle lekce, lektorka
--    a sál jako u poslední Zumby fitness).
INSERT INTO "class_sessions" ("id", "class_type_id", "instructor_id", "starts_at", "duration_min", "capacity", "credit_cost", "drop_in_price", "room", "title")
SELECT 'eb02e8c9-b68d-46e6-9e0a-aea600d38dde', ct."id", last."instructor_id", '2026-11-29 18:00:00+01', ct."duration_min", ct."capacity",
  ct."credit_cost", ct."drop_in_price", last."room", 'Zumba fitness s Kikinou'
FROM (SELECT * FROM "class_types" WHERE "slug" = 'zumba-fitness' LIMIT 1) ct
LEFT JOIN LATERAL (
  SELECT x."instructor_id", x."room" FROM "class_sessions" x
  WHERE x."class_type_id" = ct."id" AND x."status"::text <> 'cancelled'
  ORDER BY x."starts_at" DESC LIMIT 1
) last ON true
WHERE NOT EXISTS (
  SELECT 1 FROM "class_sessions" y JOIN "class_types" t ON t."id" = y."class_type_id"
  WHERE (t."slug" = 'zumba-fitness' OR (t."name" ILIKE 'Zumba%' AND t."name" NOT ILIKE '%toning%')) AND y."starts_at" = '2026-11-29 18:00:00+01' AND y."status"::text <> 'cancelled'
) AND NOT EXISTS (SELECT 1 FROM "class_sessions" WHERE "id" = 'eb02e8c9-b68d-46e6-9e0a-aea600d38dde');
--> statement-breakpoint
-- 2) Už vypsaná Zumba v tu dobu dostane název – jen když ještě nemá vlastní.
UPDATE "class_sessions" s SET "title" = 'Zumba fitness s Kikinou'
FROM "class_types" t
WHERE t."id" = s."class_type_id" AND (t."slug" = 'zumba-fitness' OR (t."name" ILIKE 'Zumba%' AND t."name" NOT ILIKE '%toning%')) AND s."starts_at" = '2026-11-29 18:00:00+01'
  AND s."status"::text <> 'cancelled' AND coalesce(s."title", '') = '';
--> statement-breakpoint
-- 3) Připnutý příspěvek na nástěnce s odkazem přímo na rezervaci té lekce (bez ní na rozvrh). Pevné id: vznikne jednou
--    a dá se upravit v Administrace → Aktuality.
INSERT INTO "announcements" ("id", "title", "body", "is_pinned", "is_published")
SELECT '7dd69a80-20af-42b8-82c5-4418514e62e6', '💃 Zumba fitness s Kikinou – neděle 29. 11. v 18:00',
  $a$<p>Tuhle neděli za námi přijede <strong>Krista Světnická – Kikina</strong> a lekci Zumba fitness si s námi zatančí spolu s Terezou. Dvojitá dávka energie, latinskoamerické rytmy a parta, se kterou se večer protančí sám. 💛</p>
<ul>
<li>🕕 <strong>neděle 29. 11. v 18:00</strong>, studio OCTOPUSH</li>
<li>👟 žádné zkušenosti ani taneční průprava – stačí chuť se hýbat a dobrá nálada</li>
<li>💳 rezervuje se a platí jako každá Zumba fitness</li>
</ul>
<p>Přijď, ať jsi u nás poprvé, nebo po sté. 👉 <a href="$a$ || coalesce('/rozvrh/' || s."id", '/rozvrh') || $b$">Rezervuj si místo</a></p>
<p>Těšíme se na tebe! 💃</p>$b$,
  true, true
FROM (SELECT 1) one
LEFT JOIN LATERAL (
  SELECT x."id" FROM "class_sessions" x JOIN "class_types" t ON t."id" = x."class_type_id"
  WHERE (t."slug" = 'zumba-fitness' OR (t."name" ILIKE 'Zumba%' AND t."name" NOT ILIKE '%toning%')) AND x."starts_at" = '2026-11-29 18:00:00+01' AND x."status"::text <> 'cancelled'
  ORDER BY x."created_at" LIMIT 1
) s ON true
WHERE NOT EXISTS (SELECT 1 FROM "announcements" WHERE "id" = '7dd69a80-20af-42b8-82c5-4418514e62e6');
