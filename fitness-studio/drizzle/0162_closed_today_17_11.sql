-- Úterý 17. 11. 2026: studio je z provozních důvodů zavřené, zítra 18. 11. normálně otevřeno.
--
-- Dnešní lekce to mají v poznámce (kde žádnou nemají), aby se na ně nikdo nepřihlásil…
UPDATE "class_sessions" SET "note" = 'Lekce se nekoná – dnes 17. 11. máme z provozních důvodů zavřeno. Moc se omlouváme! Přihlášeným vracíme vstup nebo kredit na účet. Uvidíme se zítra 18. 11.'
WHERE "starts_at" >= '2026-11-17 00:00:00+01' AND "starts_at" < '2026-11-18 00:00:00+01'
  AND "status"::text = 'scheduled' AND coalesce(trim("note"), '') = '';
--> statement-breakpoint
-- …a ty, na kterých nikdo není (ani v pořadníku), se rovnou zruší. Lekce s přihlášenými ruší studio v administraci –
-- tím se vrátí, co zaplatili, a přijde jim e-mail.
UPDATE "class_sessions" s SET "status" = 'cancelled'
WHERE s."starts_at" >= '2026-11-17 00:00:00+01' AND s."starts_at" < '2026-11-18 00:00:00+01'
  AND s."status"::text = 'scheduled'
  AND NOT EXISTS (SELECT 1 FROM "bookings" b WHERE b."session_id" = s."id" AND b."status"::text <> 'cancelled');
--> statement-breakpoint
-- Omluvný e-mail jako KONCEPT v Administrace → Zprávy: provozní zpráva pro členy – studio ho zkontroluje, případně změní,
-- komu půjde, a odešle samo. Pevné id, vznikne jednou.
INSERT INTO "campaigns" ("id", "channel", "purpose", "name", "subject", "body", "audience", "status")
SELECT '6f1d2b84-93ae-4c57-b0e8-1a7c5d39e264', 'email', 'service',
  'Dnes 17. 11. zavřeno',
  'Dnes 17. 11. máme zavřeno – uvidíme se zítra',
  $body$Ahoj {{osloveni}},

moc se omlouváme, ale dnes 17. 11. máme z provozních důvodů zavřeno.

• Dnešní lekce Strong Nation v 17:00 se nekoná.
• Máš na ni rezervaci? Vstup nebo kredit ti vracíme na účet.

Zítra 18. 11. už jsme zase tady a těšíme se na tebe – v 17:00 na Reformer fusion a v 18:00 na Kettlebell. 💪

**Rezervuj si lekci:** https://www.octopush.fit/rozvrh

Děkujeme za pochopení! 💛
Tým OCTOPUSH$body$,
  '{"segment":"members"}'::jsonb, 'draft'
WHERE NOT EXISTS (SELECT 1 FROM "campaigns" WHERE "id" = '6f1d2b84-93ae-4c57-b0e8-1a7c5d39e264');
