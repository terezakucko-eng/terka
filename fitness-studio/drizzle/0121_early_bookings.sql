CREATE TABLE "early_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"membership_id" uuid,
	"signed_up_at" timestamp with time zone NOT NULL,
	"gift_id" uuid,
	"santa_given_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "early_bookings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "early_bookings" ADD CONSTRAINT "early_bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "early_bookings" ADD CONSTRAINT "early_bookings_membership_id_entitlements_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."entitlements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "early_bookings" ADD CONSTRAINT "early_bookings_gift_id_entitlements_id_fk" FOREIGN KEY ("gift_id") REFERENCES "public"."entitlements"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- Dárek za včasnou rezervaci, as the studio set it: only a NEW membership with commitment starting from 1. 11. 2026 to
-- 1. 1. 2027 (presale included), Členství Reformer too – not memberships running from before. Gifts from 0119 to others
-- go away (none used yet – they are valid from 2027).
DELETE FROM "entitlements" g
WHERE g."kind"::text = 'free' AND g."name" = 'Reformer bez doplatku 2027' AND g."entries_used" = 0
  AND NOT EXISTS (
    SELECT 1 FROM "entitlements" e LEFT JOIN "products" p ON p."id" = e."product_id"
    WHERE e."user_id" = g."user_id" AND e."kind"::text = 'membership' AND e."status"::text = 'active'
    AND e."valid_from" >= '2026-11-01T00:00:00+01:00' AND e."valid_from" <= '2027-01-01T00:00:00+01:00'
    AND (p."id" IS NULL OR p."commitment_months" <> 0)
  );
--> statement-breakpoint
INSERT INTO "entitlements" ("user_id", "kind", "name", "entries_total", "class_type_id", "valid_from", "valid_until", "note")
SELECT m."user_id", 'free', 'Reformer bez doplatku 2027', 4, ct."id", '2027-01-01T00:00:00+01:00', '2028-01-01T00:00:00+01:00', 'Dárek za včasnou rezervaci členství na rok 2027'
FROM (
  SELECT DISTINCT e."user_id"
  FROM "entitlements" e LEFT JOIN "products" p ON p."id" = e."product_id"
  WHERE e."kind"::text = 'membership' AND e."status"::text = 'active'
    AND e."valid_from" >= '2026-11-01T00:00:00+01:00' AND e."valid_from" <= '2027-01-01T00:00:00+01:00'
    AND (p."id" IS NULL OR p."commitment_months" <> 0)
) m
CROSS JOIN (SELECT "id" FROM "class_types" WHERE "slug" = 'reformer-fusion' LIMIT 1) ct
WHERE NOT EXISTS (SELECT 1 FROM "entitlements" x WHERE x."user_id" = m."user_id" AND x."kind"::text = 'free' AND x."name" = 'Reformer bez doplatku 2027');
--> statement-breakpoint
-- Who signed up in time and when (ordered, or set up by the studio) – by 30. 11. Fitness Ježíšek brings a gift.
INSERT INTO "early_bookings" ("user_id", "membership_id", "signed_up_at", "gift_id")
SELECT DISTINCT ON (e."user_id") e."user_id", e."id", COALESCE(o."created_at", e."created_at"),
  (SELECT g."id" FROM "entitlements" g WHERE g."user_id" = e."user_id" AND g."kind"::text = 'free' AND g."name" = 'Reformer bez doplatku 2027' LIMIT 1)
FROM "entitlements" e
LEFT JOIN "products" p ON p."id" = e."product_id"
LEFT JOIN "orders" o ON o."id" = e."order_id"
WHERE e."kind"::text = 'membership' AND e."status"::text = 'active'
    AND e."valid_from" >= '2026-11-01T00:00:00+01:00' AND e."valid_from" <= '2027-01-01T00:00:00+01:00'
    AND (p."id" IS NULL OR p."commitment_months" <> 0)
ORDER BY e."user_id", COALESCE(o."created_at", e."created_at")
ON CONFLICT ("user_id") DO NOTHING;
--> statement-breakpoint
-- The board post says so, and Program Dovolená is Zmražení členství now (only if the post wasn't edited meanwhile).
UPDATE "announcements" SET
  "title" = '🎁 Členství 2027: dárky za včasnou rezervaci a zmražení členství',
  "body" = $body$<p>Chceme odměnit každého, kdo s námi bude cvičit i v roce 2027. 💛 Kdo se ke členství přihlásí včas, dostane dárky – a pro všechny členy se závazkem je od ledna novinka: zmražení členství.</p>
<h3>🎅 Fitness Ježíšek – do 30. 11.</h3>
<p>Přihlas se ke členství na rok 2027 <strong>do 30. listopadu</strong> a v prosinci tě navštíví Fitness Ježíšek s dárkem. 🎄</p>
<h3>🎁 4× Reformer bez doplatku – do 31. 12.</h3>
<ul>
<li>Kdo si <strong>do 31. 12. 2026</strong> sjedná nové členství se závazkem – od listopadu, nebo rovnou na rok 2027 v předprodeji –, dostane do účtu <strong>4 lekce Reformer fusion bez doplatku</strong>.</li>
<li>Platí i pro <strong>Členství Reformer</strong> – k 8 Reformerům měsíčně máš ještě 4 navíc. 💪</li>
<li>Lekce využiješ kdykoli během roku 2027. Když je vyčerpáš, na další Reformer se doplácí jako obvykle (250 Kč).</li>
<li>Už máš členství na rok 2027 zarezervované? Lekce najdeš v Můj účet. ✅ Nové rezervace je dostanou hned po zaplacení.</li>
<li>Kdo se přihlásí až v lednu, už je nedostane.</li>
</ul>
<h3>❄️ Zmražení členství – od ledna 2027</h3>
<ul>
<li>Dovolená, nemoc nebo cokoli jiného? <strong>2× za rok si zmraz členství na týden</strong> – 7 dní po sobě, nejdřív od zítřka.</li>
<li>Ten týden <strong>nezaplatíš</strong> – platba za daný měsíc se sníží poměrně podle dní (u členství za 1 400 Kč zhruba o 320 Kč).</li>
<li>Zmrazíš si ho v Můj účet. Je-li platba za ten měsíc už zaplacená, sleva se odečte z té příští.</li>
<li>Během zmražení se na lekce nepřihlašuješ – rezervace na ten týden se samy zruší a vstupy se vrátí.</li>
<li>Do začátku zmražení ho můžeš zrušit.</li>
<li>Platí pro všechna členství se závazkem. Členství Reformer si i v měsíci se zmražením nechává všech 8 lekcí.</li>
</ul>
<p><a href="/cenik?rok=2027">👉 Zarezervovat členství na rok 2027</a></p>
<p><a href="/rozvrh">👉 Rezervace lekcí</a></p>$body$
WHERE "id" = 'ec9596c8-12e0-4cf2-97ff-d54610740a2d' AND "body" LIKE '%Každý, kdo je k 1. 1. 2027 naším členem se závazkem%';
--> statement-breakpoint
UPDATE "content" SET "value" = $t$Přihlas se ke členství na rok 2027 do 30. 11. a v prosinci tě navštíví Fitness Ježíšek 🎅. Do konce roku k tomu dostaneš 4× Reformer bez doplatku. A nově zmražení členství – 2× ročně týden zdarma, když jedeš na dovolenou nebo stůněš.$t$, "updated_at" = now()
WHERE "key" = 'popupNext.text' AND "value" = $t$Zarezervuj si členství na rok 2027 do 30. 11. a v prosinci tě navštíví Fitness Ježíšek 🎅. Do konce roku k tomu dostaneš 4× Reformer bez doplatku. A nově Program Dovolená – 2× ročně týden pryč a nezaplatíš ho.$t$;
--> statement-breakpoint
-- Terms (if saved): the same in section 4.
UPDATE "content" SET "value" = replace(replace("value", $t$Program Dovolená (od 1. 1. 2027): člen se závazkem si může 2× za kalendářní rok naplánovat v Můj účet týden dovolené (7 dní po sobě), nejpozději 7 dní předem. Platba za měsíc, do kterého dovolená spadá, se sníží poměrně podle dní dovolené v tom měsíci (měsíční platba ÷ počet dní měsíce × dny dovolené). Je-li platba za ten měsíc už uhrazená, sleva se odečte z nejbližší další platby. Během dovolené se klient na lekce přihlásit nemůže; rezervace na tyto dny se při naplánování zruší a vstupy či kredity se vrátí. Dovolenou lze zrušit do jejího začátku; byla-li snížená platba už uhrazená, vznikne doplatek. Počet lekcí v ceně členství (např. Členství Reformer) se v měsíci s dovolenou nemění.$t$, $t$Zmražení členství (od 1. 1. 2027): člen se závazkem si může 2× za kalendářní rok v Můj účet zmrazit členství na týden (7 dní po sobě) – kvůli dovolené, nemoci nebo z jiného důvodu – nejdříve od následujícího dne. Platba za měsíc, do kterého týden spadá, se sníží poměrně podle dní v tom měsíci (měsíční platba ÷ počet dní měsíce × dny zmražení). Je-li platba za ten měsíc už uhrazená, sleva se odečte z nejbližší další platby. Během zmražení se klient na lekce přihlásit nemůže; rezervace na tyto dny se při zmražení zruší a vstupy, kredity i doplatky se vrátí. Zmražení lze zrušit do jeho začátku; byla-li snížená platba už uhrazená, vznikne doplatek. Počet lekcí v ceně členství (např. Členství Reformer) se v měsíci se zmražením nemění.$t$), $t$Dárek za včasnou rezervaci: kdo je k 1. 1. 2027 členem se závazkem (členství na rok 2027 zarezervované do 31. 12. 2026), dostane 4 vstupy na Reformer fusion bez doplatku, platné od 1. 1. do 31. 12. 2027. Netýká se členství s lekcemi v ceně (Členství Reformer). Nevyužité vstupy propadají.$t$, $t$Dárek za včasnou rezervaci: kdo si sjedná nové členství se závazkem s počátkem od 1. 11. 2026 do 1. 1. 2027 (i v předprodeji na rok 2027, včetně Členství Reformer), dostane 4 vstupy na Reformer fusion bez doplatku, platné od 1. 1. do 31. 12. 2027; kdo si ho sjedná do 30. 11. 2026, dostane v prosinci navíc dárek od Fitness Ježíška. Členství sjednaná dříve ani od ledna 2027 se dárku netýkají. Nevyužité vstupy propadají.$t$), "updated_at" = now()
WHERE "key" = 'terms.body' AND "value" LIKE '%Program Dovolená (od 1. 1. 2027)%';
