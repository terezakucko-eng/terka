-- Dárek za včasnou rezervaci: who is a member with commitment on 1. 1. 2027 gets 4× Reformer fusion without the
-- surcharge for 2027 (not Členství Reformer – it has Reformer in its price). Members already signed up get it now;
-- who signs up by the end of 2026 gets it on purchase (the code), January sign-ups don't.
INSERT INTO "entitlements" ("user_id", "kind", "name", "entries_total", "class_type_id", "valid_from", "valid_until", "note")
SELECT m."user_id", 'free', 'Reformer bez doplatku 2027', 4, ct."id", '2027-01-01T00:00:00+01:00', '2028-01-01T00:00:00+01:00', 'Dárek za včasnou rezervaci členství na rok 2027'
FROM (
  SELECT DISTINCT e."user_id"
  FROM "entitlements" e
  LEFT JOIN "products" p ON p."id" = e."product_id"
  WHERE e."kind"::text = 'membership' AND e."status"::text = 'active'
    AND e."valid_from" <= '2027-01-01T00:00:00+01:00' AND e."valid_until" > '2027-01-01T00:00:00+01:00'
    AND e."included_per_month" = 0 AND (p."id" IS NULL OR p."commitment_months" <> 0)
) m
CROSS JOIN (SELECT "id" FROM "class_types" WHERE "slug" = 'reformer-fusion' LIMIT 1) ct
WHERE NOT EXISTS (SELECT 1 FROM "entitlements" x WHERE x."user_id" = m."user_id" AND x."kind"::text = 'free' AND x."name" = 'Reformer bez doplatku 2027');
--> statement-breakpoint
-- Board post (Nástěnka) about the rewards for members, pinned. Fixed id, so it is created once and can be edited in Administrace → Aktuality.
INSERT INTO "announcements" ("id", "title", "body", "is_pinned", "is_published") VALUES (
  'ec9596c8-12e0-4cf2-97ff-d54610740a2d',
  '🎁 Členství 2027: dárky za včasnou rezervaci a Program Dovolená',
  $body$<p>Chceme odměnit každého, kdo s námi cvičí pravidelně. 💛 Pro členy se závazkem máme od ledna dvě novinky – a kdo se rozhodne včas, dostane k tomu dárky.</p>
<h3>🎅 Fitness Ježíšek – do 30. 11.</h3>
<p>Zarezervuj si členství na rok 2027 <strong>do 30. listopadu</strong> a v prosinci tě navštíví Fitness Ježíšek s dárkem. 🎄</p>
<h3>🎁 4× Reformer bez doplatku – do 31. 12.</h3>
<ul>
<li>Každý, kdo je k 1. 1. 2027 naším členem se závazkem, dostane do účtu <strong>4 lekce Reformer fusion bez doplatku</strong>.</li>
<li>Využiješ je kdykoli během roku 2027. Když je vyčerpáš, na další Reformer se doplácí jako obvykle (250 Kč).</li>
<li>Máš členství na rok 2027 už teď? Lekce najdeš v Můj účet. ✅ Kdo si členství zarezervuje do konce prosince, dostane je hned po zaplacení.</li>
<li>Kdo se přihlásí až v lednu, už je nedostane.</li>
<li>Členství Reformer má Reformer v ceně každý měsíc (8×), proto se ho dárek netýká.</li>
</ul>
<h3>🏖️ Program Dovolená – od ledna 2027</h3>
<ul>
<li>Jedeš pryč? <strong>2× za rok si naplánuj týden dovolené</strong> – 7 dní po sobě, začít můžeš kterýkoli den.</li>
<li>O ten týden <strong>zaplatíš za daný měsíc méně</strong> – poměrně podle dní, u členství za 1 400 Kč zhruba o 320 Kč.</li>
<li>Dovolenou si naplánuješ v Můj účet nejpozději 7 dní předem. Je-li platba za ten měsíc už zaplacená, sleva se odečte z té příští.</li>
<li>Během dovolené se na lekce nepřihlašuješ – rezervace na ten týden se při naplánování samy zruší a vstupy se vrátí.</li>
<li>Do začátku dovolené ji můžeš zrušit.</li>
<li>Platí pro všechna členství se závazkem. Členství Reformer si i v měsíci s dovolenou nechává všech 8 lekcí.</li>
</ul>
<p><a href="/cenik?rok=2027">👉 Zarezervovat členství na rok 2027</a></p>
<p><a href="/rozvrh">👉 Rezervace lekcí</a></p>$body$,
  true,
  true
) ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- The next pop-up, from Saturday 31. 10. (after the Barre Brunch one), leads to the post. It shows from its date with
-- the code that knows "Další vyskakovací okno"; the version running now ignores these keys.
INSERT INTO "content" ("key", "value", "updated_at") VALUES
  ('popupNext.from', '2026-10-31', now()),
  ('popupNext.title', '🎁 Dárky pro členy na rok 2027', now()),
  ('popupNext.text', 'Zarezervuj si členství na rok 2027 do 30. 11. a v prosinci tě navštíví Fitness Ježíšek 🎅. Do konce roku k tomu dostaneš 4× Reformer bez doplatku. A nově Program Dovolená – 2× ročně týden pryč a nezaplatíš ho.', now()),
  ('popupNext.buttonLabel', 'Chci vědět víc', now()),
  ('popupNext.buttonUrl', '/nastenka#ec9596c8-12e0-4cf2-97ff-d54610740a2d', now()),
  ('popupNext.buttonLabel2', '', now()),
  ('popupNext.buttonUrl2', '', now()),
  ('popupNext.until', '2026-12-31', now())
ON CONFLICT ("key") DO NOTHING;

--> statement-breakpoint
-- Terms (if saved in the admin): Program Dovolená and the early-booking gift at the end of section 4.
UPDATE "content" SET "value" = replace("value", E'\n\n## 5. Platby', $t$
- Program Dovolená (od 1. 1. 2027): člen se závazkem si může 2× za kalendářní rok naplánovat v Můj účet týden dovolené (7 dní po sobě), nejpozději 7 dní předem. Platba za měsíc, do kterého dovolená spadá, se sníží poměrně podle dní dovolené v tom měsíci (měsíční platba ÷ počet dní měsíce × dny dovolené). Je-li platba za ten měsíc už uhrazená, sleva se odečte z nejbližší další platby. Během dovolené se klient na lekce přihlásit nemůže; rezervace na tyto dny se při naplánování zruší a vstupy či kredity se vrátí. Dovolenou lze zrušit do jejího začátku; byla-li snížená platba už uhrazená, vznikne doplatek. Počet lekcí v ceně členství (např. Členství Reformer) se v měsíci s dovolenou nemění.
- Dárek za včasnou rezervaci: kdo je k 1. 1. 2027 členem se závazkem (členství na rok 2027 zarezervované do 31. 12. 2026), dostane 4 vstupy na Reformer fusion bez doplatku, platné od 1. 1. do 31. 12. 2027. Netýká se členství s lekcemi v ceně (Členství Reformer). Nevyužité vstupy propadají.$t$ || E'\n\n## 5. Platby'), "updated_at" = now()
WHERE "key" = 'terms.body' AND "value" NOT LIKE '%Program Dovolená%';
--> statement-breakpoint
-- …the same when the terms were saved from the formatting editor (HTML).
UPDATE "content" SET "value" = replace("value", '<h2>5. Platby</h2>', $t$<ul><li>Program Dovolená (od 1. 1. 2027): člen se závazkem si může 2× za kalendářní rok naplánovat v Můj účet týden dovolené (7 dní po sobě), nejpozději 7 dní předem. Platba za měsíc, do kterého dovolená spadá, se sníží poměrně podle dní dovolené v tom měsíci (měsíční platba ÷ počet dní měsíce × dny dovolené). Je-li platba za ten měsíc už uhrazená, sleva se odečte z nejbližší další platby. Během dovolené se klient na lekce přihlásit nemůže; rezervace na tyto dny se při naplánování zruší a vstupy či kredity se vrátí. Dovolenou lze zrušit do jejího začátku; byla-li snížená platba už uhrazená, vznikne doplatek. Počet lekcí v ceně členství (např. Členství Reformer) se v měsíci s dovolenou nemění.</li><li>Dárek za včasnou rezervaci: kdo je k 1. 1. 2027 členem se závazkem (členství na rok 2027 zarezervované do 31. 12. 2026), dostane 4 vstupy na Reformer fusion bez doplatku, platné od 1. 1. do 31. 12. 2027. Netýká se členství s lekcemi v ceně (Členství Reformer). Nevyužité vstupy propadají.</li></ul>$t$ || '<h2>5. Platby</h2>'), "updated_at" = now()
WHERE "key" = 'terms.body' AND "value" NOT LIKE '%Program Dovolená%';
