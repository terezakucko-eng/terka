-- Reformer od 1. 1. 2027 (rozhodnutí studia 16. 11. 2026, „balíček 120“):
--   skupinová lekce (nejvýš 5 lidí) 390 Kč / 340 kreditů, permanentka 1 vstup + 100 Kč, všichni členové doplácí 120 Kč;
--   nová lekce ve dvou 490 Kč / 430 kreditů, permanentka 2 vstupy, členové doplácí 240 Kč, z lekcí v ceně a dárků bere dvě;
--   Členství Reformer 2 300 Kč (místo 2 500 Kč) – i pro ty, kdo ho už mají zarezervované.
-- Všechno je hlídané na dosavadní hodnoty: co si studio mezitím upravilo v administraci, zůstává. Opakované spuštění nic nezmění.
-- Starý kód s daty funguje: nové sloupce nezná a lekce ve dvou zatím nemá žádné termíny.

-- 1) Reformer fusion: ceník od 1. 1. 2027 – jen dokud je tam ohlášený doplatek 250 Kč.
UPDATE "class_types" SET
  "member_surcharge_next" = 12000, "drop_in_price_next" = 39000, "credit_cost_next" = 340,
  "pass_entries_next" = 1, "pass_surcharge_next" = 10000
WHERE "slug" = 'reformer-fusion' AND "member_surcharge_next_from" = '2027-01-01' AND "member_surcharge_next" = 25000;
--> statement-breakpoint
-- „Zaváděcí cena pro rok 2026“ u 490 Kč už neplatí – od ledna je skupinová lekce levnější.
UPDATE "class_types" SET "price_note" = '', "price_note_until" = NULL
WHERE "slug" = 'reformer-fusion' AND "price_note" = 'Zaváděcí cena pro rok 2026' AND "drop_in_price_next" = 39000;
--> statement-breakpoint
-- Skupinová lekce pro 5 lidí: nové termíny se tak založí; lednové, na kterých není víc než 5 lidí, se upraví.
UPDATE "class_types" SET "capacity" = 5
WHERE "slug" = 'reformer-fusion' AND "capacity" = 6 AND "drop_in_price_next" = 39000;
--> statement-breakpoint
UPDATE "class_sessions" s SET "capacity" = 5
FROM "class_types" ct
WHERE ct."id" = s."class_type_id" AND ct."slug" = 'reformer-fusion' AND ct."capacity" = 5
  AND s."starts_at" >= '2027-01-01 00:00:00+01' AND s."status"::text = 'scheduled' AND s."capacity" = 6
  AND (SELECT coalesce(sum(b."seats"), 0) FROM "bookings" b WHERE b."session_id" = s."id" AND b."status"::text <> 'cancelled') <= 5;
--> statement-breakpoint
-- Lednové termíny založené ještě se starou cenou, na kterých nikdo není: cena z nového ceníku.
UPDATE "class_sessions" s SET "drop_in_price" = ct."drop_in_price_next", "credit_cost" = ct."credit_cost_next"
FROM "class_types" ct
WHERE ct."id" = s."class_type_id" AND ct."slug" = 'reformer-fusion' AND ct."drop_in_price_next" = 39000 AND ct."credit_cost_next" = 340
  AND s."starts_at" >= '2027-01-01 00:00:00+01' AND s."status"::text = 'scheduled'
  AND s."drop_in_price" = ct."drop_in_price" AND s."credit_cost" = ct."credit_cost"
  AND NOT EXISTS (SELECT 1 FROM "bookings" b WHERE b."session_id" = s."id" AND b."status"::text <> 'cancelled');
--> statement-breakpoint
-- 2) Lekce ve dvou: vlastní typ lekce se svou cenou, kapacitou 2 a doplatkem. Počítá se jako dvě lekce Reformer fusion:
--    platí na ni lekce v ceně Členství Reformer i dárkové lekce bez doplatku (bere dvě) a přednostní rezervace.
--    Úvodní vstup zdarma, lekce z kartičky ani cena první lekce na ni neplatí. Pevné id – vznikne jednou.
INSERT INTO "class_types" ("id", "name", "slug", "description", "keywords", "duration_min", "capacity", "credit_cost", "drop_in_price", "color", "image_url", "video_url", "level",
  "member_surcharge", "pass_entries", "no_free_entry", "pass_card_entry", "cancellation_hours", "price_note", "price_note_until",
  "counts_as_type_id", "counts_as_lessons", "is_active", "sort_order")
SELECT 'd2f6a8c4-3b17-4e59-9a0d-7c1e5b8f2a46', 'Reformer fusion ve dvou', 'reformer-fusion-ve-dvou',
  'Reformer jen pro dva. Lektorka se celou hodinu věnuje jen vám dvěma, takže každý pohyb doladí přesně na tvoje tělo a rozdíl cítíš hned. Vezmi kamarádku, mámu nebo partnera, nebo přijď sama a poznej nového parťáka na stroji vedle. Odcházíš protažená, zpevněná a s pocitem, že tahle hodina patřila jen tobě.',
  'reformer ve dvou Ostrava, reformer pro dva, pilates reformer Ostrava, reformer s individuálním přístupem',
  r."duration_min", 2, 430, 49000, r."color", r."image_url", r."video_url", r."level",
  24000, 2, true, false, coalesce(r."cancellation_hours", 24), 'Nově od ledna 2027', '2027-01-01',
  r."id", 2, true, r."sort_order"
FROM "class_types" r
WHERE r."slug" = 'reformer-fusion' AND r."archived_at" IS NULL AND r."drop_in_price_next" = 39000
  AND NOT EXISTS (SELECT 1 FROM "class_types" x WHERE x."id" = 'd2f6a8c4-3b17-4e59-9a0d-7c1e5b8f2a46' OR x."slug" = 'reformer-fusion-ve-dvou');
--> statement-breakpoint
-- 3) Členství Reformer za 2 300 Kč a v ceně je jakýkoli Reformer (lekce ve dvou se počítá za dvě).
UPDATE "products" SET "price" = 230000
WHERE "id" = 'b09203a4-b468-4653-be2b-01d41922d888' AND "price" = 250000;
--> statement-breakpoint
UPDATE "products" SET "description" = replace("description", '8× Reformer fusion měsíčně v ceně', '8× Reformer měsíčně v ceně (lekce ve dvou se počítá za dvě)')
WHERE "id" = 'b09203a4-b468-4653-be2b-01d41922d888' AND "price" = 230000 AND "description" LIKE '%8× Reformer fusion měsíčně v ceně%';
--> statement-breakpoint
-- Kdo ho už má zarezervované (předprodej, přechod v Můj účet, nastavené studiem): měsíční příspěvek 2 300 Kč…
UPDATE "entitlements" SET "monthly_fee" = 230000
WHERE "product_id" = 'b09203a4-b468-4653-be2b-01d41922d888' AND "kind"::text = 'membership' AND "status"::text = 'active' AND "monthly_fee" = 250000;
--> statement-breakpoint
-- …i výzvy k platbě za měsíce roku 2027, které už vznikly a nejsou zaplacené…
UPDATE "orders" o SET "amount" = 230000
WHERE o."kind"::text = 'membership_fee' AND o."status"::text = 'pending' AND o."period" >= '2027-01' AND o."amount" = 250000
  AND EXISTS (SELECT 1 FROM "entitlements" e WHERE e."user_id" = o."user_id" AND e."product_id" = 'b09203a4-b468-4653-be2b-01d41922d888'
    AND e."kind"::text = 'membership' AND e."status"::text = 'active');
--> statement-breakpoint
-- …a kdo už leden zaplatil za 2 500 Kč (koupí členství), dostane rozdíl 200 Kč jako kredit na účet (1 Kč = 1 kredit, vrácený kredit platí aspoň 60 dní).
WITH due AS (
  SELECT DISTINCT e."user_id" FROM "entitlements" e
  JOIN "orders" o ON o."id" = e."order_id"
  WHERE e."product_id" = 'b09203a4-b468-4653-be2b-01d41922d888' AND e."kind"::text = 'membership' AND e."status"::text = 'active'
    AND e."valid_from" >= '2027-01-01 00:00:00+01' AND o."status"::text = 'paid' AND o."amount" = 250000
    AND NOT EXISTS (SELECT 1 FROM "credit_transactions" c WHERE c."user_id" = e."user_id" AND c."note" = 'Členství Reformer zlevnilo na 2 300 Kč – rozdíl za leden 2027')
), paid AS (
  UPDATE "users" u SET
    "credit_balance" = u."credit_balance" + 200,
    "credit_expires_at" = CASE WHEN u."credit_expires_at" IS NOT NULL AND u."credit_expires_at" < now() + interval '60 days' THEN now() + interval '60 days' ELSE u."credit_expires_at" END,
    "credit_expiry_warned_at" = CASE WHEN u."credit_expires_at" IS NOT NULL AND u."credit_expires_at" < now() + interval '60 days' THEN NULL ELSE u."credit_expiry_warned_at" END
  FROM due WHERE u."id" = due."user_id"
  RETURNING u."id", u."credit_balance"
)
INSERT INTO "credit_transactions" ("user_id", "delta", "balance_after", "reason", "note")
SELECT "id", 200, "credit_balance", 'refund', 'Členství Reformer zlevnilo na 2 300 Kč – rozdíl za leden 2027' FROM paid;
--> statement-breakpoint
-- 4) Texty – jen když nové ceny opravdu platí. Nástěnka o dárcích pro členy 2027: lekce ve dvou bere dvě dárkové lekce, a kolik se pak doplácí.
UPDATE "announcements" SET "body" = replace(replace("body",
    'Lekce využiješ kdykoli během roku 2027. Na další Reformer se pak doplácí jako obvykle (250 Kč).',
    'Lekce využiješ kdykoli během roku 2027 – na skupinovou lekci jednu, na lekci ve dvou dvě. Na další Reformer se pak doplácí jako obvykle (skupinová lekce 120 Kč, lekce ve dvou 240 Kč).'),
    'Lekce využiješ kdykoli během roku 2027. Když je vyčerpáš, na další Reformer se doplácí jako obvykle (250 Kč).',
    'Lekce využiješ kdykoli během roku 2027 – na skupinovou lekci jednu, na lekci ve dvou dvě. Když je vyčerpáš, na další Reformer se doplácí jako obvykle (skupinová lekce 120 Kč, lekce ve dvou 240 Kč).')
WHERE "id" = 'ec9596c8-12e0-4cf2-97ff-d54610740a2d' AND "body" LIKE '%doplácí jako obvykle (250 Kč).%'
  AND EXISTS (SELECT 1 FROM "class_types" WHERE "slug" = 'reformer-fusion' AND "member_surcharge_next" = 12000 AND "drop_in_price_next" = 39000);
--> statement-breakpoint
-- Totéž v e-mailu o dárcích – jen dokud je to koncept (odeslaná zpráva se nepřepisuje).
UPDATE "campaigns" SET "body" = replace("body",
    'Lekce využiješ kdykoli během roku 2027. Na další Reformer se pak doplácí jako obvykle (250 Kč).',
    'Lekce využiješ kdykoli během roku 2027 – na skupinovou lekci jednu, na lekci ve dvou dvě. Na další Reformer se pak doplácí jako obvykle (skupinová lekce 120 Kč, lekce ve dvou 240 Kč).')
WHERE "id" = '1b19f3f2-85a4-450e-a725-1e2a51640f4f' AND "status"::text = 'draft' AND "body" LIKE '%doplácí jako obvykle (250 Kč).%'
  AND EXISTS (SELECT 1 FROM "class_types" WHERE "slug" = 'reformer-fusion' AND "member_surcharge_next" = 12000 AND "drop_in_price_next" = 39000);
--> statement-breakpoint
-- Nástěnka o Členství Reformer: nová cena, co je v ceně a jak se platí (předprodej je bez platby předem).
UPDATE "announcements" SET "body" = replace(replace("body",
    '💳 2 500 Kč měsíčně, členství na 12 měsíců – první platbou máš zaplacený leden',
    '💳 2 300 Kč měsíčně, členství na 12 měsíců – teď nic neplatíš, výzvu k platbě za leden ti pošleme v prosinci'),
    '<strong>8× Reformer fusion měsíčně v ceně</strong> – bez doplatku',
    '<strong>8× Reformer měsíčně v ceně</strong> – skupinová lekce i nová lekce ve dvou (ta se počítá za dvě), bez doplatku')
WHERE "id" = '1dd44d7a-151f-4695-8a47-a11e64aa898f' AND "body" LIKE '%💳 2 500 Kč měsíčně%'
  AND EXISTS (SELECT 1 FROM "products" WHERE "id" = 'b09203a4-b468-4653-be2b-01d41922d888' AND "price" = 230000);
--> statement-breakpoint
-- 5) Nový příspěvek na nástěnku: Reformer od ledna. Pevné id – vznikne jednou, studio ho může upravit nebo připnout v Aktualitách.
INSERT INTO "announcements" ("id", "title", "body", "is_pinned", "is_published")
SELECT 'a8e3c5d1-6f24-4b97-8c0e-2d71b4f9e635',
  '🧘‍♀️ Reformer od ledna: levněji a nově i ve dvou',
  $body$<p>Reformer vypadá jako mučidlo, ale odcházíš z něj jako znovuzrozená. Od 1. 1. 2027 se na něj dostaneš levněji a máme pro tebe i novinku. 💛</p>
<h3>Skupinová lekce – 390 Kč</h3>
<ul>
<li>Jednorázově 390 Kč (místo 490 Kč) nebo 340 kreditů.</li>
<li>S permanentkou 1 vstup + doplatek 100 Kč.</li>
<li>Členové doplácí 120 Kč.</li>
<li>Cvičíme v malé skupině, nejvýš 5 lidí, takže si tě lektorka všimne pořád.</li>
</ul>
<h3>✨ Novinka: Reformer ve dvou – 490 Kč</h3>
<p>Celá hodina jen pro dva. Lektorka se věnuje jen vám, každý pohyb doladí na míru a rozdíl ucítíš hned. Vezmi kamarádku, mámu nebo partnera, nebo přijď sama a poznej nového parťáka na stroji vedle.</p>
<ul>
<li>Jednorázově 490 Kč na osobu nebo 430 kreditů.</li>
<li>S permanentkou 2 vstupy.</li>
<li>Členové doplácí 240 Kč.</li>
<li>Termíny: úterý 18:00, středa 17:00, pátek 6:30 a sobota 7:30.</li>
</ul>
<h3>Členství Reformer – 2 300 Kč měsíčně</h3>
<ul>
<li>8× Reformer měsíčně v ceně: skupinová lekce se počítá za jednu, lekce ve dvou za dvě.</li>
<li>Přednostní rezervace Reformeru a vše z klasického členství.</li>
<li>Už ho máš zarezervované? I tobě platí od ledna nová cena 2 300 Kč.</li>
</ul>
<p>Lednový rozvrh vypíšeme brzy, dáme ti vědět. 🙂</p>
<p><a href="/cenik?rok=2027">👉 Ceník na rok 2027</a></p>$body$,
  false, true
WHERE NOT EXISTS (SELECT 1 FROM "announcements" WHERE "id" = 'a8e3c5d1-6f24-4b97-8c0e-2d71b4f9e635')
  AND EXISTS (SELECT 1 FROM "class_types" WHERE "id" = 'd2f6a8c4-3b17-4e59-9a0d-7c1e5b8f2a46');
