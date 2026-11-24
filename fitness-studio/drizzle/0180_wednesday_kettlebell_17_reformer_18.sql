-- Středa od 2. 12. 2026 (přání studia 24. 11. 2026): Kettlebell a Reformer si vyměňují čas – v 17:00 je nově Kettlebell,
-- v 18:00 skupinový Reformer (Reformer fusion). Týká se všech budoucích středečních termínů od 2. 12.; jen tam, kde
-- v novém čase ještě žádný termín téže lekce není. Kdo už je na posunuté termíny přihlášený, dostane od studia e-mail –
-- tady se připraví jako koncept, odeslat ho musí studio. Opakované spuštění nic nezmění.

-- 1) Koncept e-mailu pro přihlášené (jen když nějací jsou).
WITH moved AS (
  SELECT s."id" FROM "class_sessions" s JOIN "class_types" t ON t."id" = s."class_type_id"
  WHERE s."status"::text = 'scheduled' AND s."starts_at" >= '2026-12-02 00:00:00+01'
    AND extract(isodow FROM s."starts_at" AT TIME ZONE 'Europe/Prague') = 3
    AND ((t."slug" = 'reformer-fusion' AND (s."starts_at" AT TIME ZONE 'Europe/Prague')::time = '17:00')
      OR (t."slug" = 'kettlebell' AND (s."starts_at" AT TIME ZONE 'Europe/Prague')::time = '18:00'))
), people AS (
  SELECT DISTINCT b."user_id" FROM "bookings" b JOIN moved m ON m."id" = b."session_id"
  WHERE b."user_id" IS NOT NULL AND NOT b."is_hold" AND b."status"::text IN ('pending_payment', 'confirmed', 'waitlist')
)
INSERT INTO "campaigns" ("id", "channel", "purpose", "name", "subject", "body", "audience", "status")
SELECT '76e9fcf1-629f-43c0-9839-e5a375890bd0', 'email', 'service',
  'Středa od 2. 12.: Kettlebell v 17:00, Reformer v 18:00',
  'Ve středu prohazujeme: Kettlebell v 17:00, Reformer v 18:00',
  $body$Ahoj {{osloveni}},

máme pro tebe malou změnu: od středy 2. 12. si Kettlebell a Reformer prohazují čas.

• 17:00–18:00 Kettlebell
• 18:00–19:00 Reformer fusion

• Tvoje rezervace platí, jen v novém čase.
• Když ti nový čas nevyhovuje, napiš nám – rezervaci zrušíme a vstup ti vrátíme, nebo tě přesuneme na jiný termín.

**Rozvrh:** https://www.octopush.fit/rozvrh

Těšíme se na tebe! 💛
Tým OCTOPUSH$body$,
  jsonb_build_object('segment', 'people', 'userIds', (SELECT jsonb_agg(p."user_id"::text) FROM people p)), 'draft'
WHERE EXISTS (SELECT 1 FROM people)
  AND NOT EXISTS (SELECT 1 FROM "campaigns" WHERE "id" = '76e9fcf1-629f-43c0-9839-e5a375890bd0');
--> statement-breakpoint
-- 2) Výměna časů: Reformer 17:00 → 18:00, Kettlebell 18:00 → 17:00 (obojí najednou, ve stejný den).
UPDATE "class_sessions" s
SET "starts_at" = ((s."starts_at" AT TIME ZONE 'Europe/Prague')::date
  + CASE WHEN t."slug" = 'reformer-fusion' THEN time '18:00' ELSE time '17:00' END) AT TIME ZONE 'Europe/Prague'
FROM "class_types" t
WHERE t."id" = s."class_type_id" AND s."status"::text = 'scheduled' AND s."starts_at" >= '2026-12-02 00:00:00+01'
  AND extract(isodow FROM s."starts_at" AT TIME ZONE 'Europe/Prague') = 3
  AND ((t."slug" = 'reformer-fusion' AND (s."starts_at" AT TIME ZONE 'Europe/Prague')::time = '17:00')
    OR (t."slug" = 'kettlebell' AND (s."starts_at" AT TIME ZONE 'Europe/Prague')::time = '18:00'))
  AND NOT EXISTS (
    SELECT 1 FROM "class_sessions" x
    WHERE x."class_type_id" = s."class_type_id" AND x."id" <> s."id" AND x."status"::text <> 'cancelled'
      AND x."starts_at" = ((s."starts_at" AT TIME ZONE 'Europe/Prague')::date
        + CASE WHEN t."slug" = 'reformer-fusion' THEN time '18:00' ELSE time '17:00' END) AT TIME ZONE 'Europe/Prague'
  );
--> statement-breakpoint
-- 3) Příspěvek „Reformer od prosince“ na nástěnce: středa nově v 18:00.
UPDATE "announcements" SET "body" = replace("body",
    'Termíny: pondělí 6:00, úterý 18:00, středa 17:00, pátek 6:30 a neděle 17:00.',
    'Termíny: pondělí 6:00, úterý 18:00, středa 18:00, pátek 6:30 a neděle 17:00.')
WHERE "id" = 'a8e3c5d1-6f24-4b97-8c0e-2d71b4f9e635'
  AND "body" LIKE '%Termíny: pondělí 6:00, úterý 18:00, středa 17:00, pátek 6:30 a neděle 17:00.%'
  AND EXISTS (
    SELECT 1 FROM "class_sessions" s JOIN "class_types" t ON t."id" = s."class_type_id"
    WHERE t."slug" = 'reformer-fusion' AND s."status"::text = 'scheduled' AND s."starts_at" >= '2026-12-02 00:00:00+01'
      AND extract(isodow FROM s."starts_at" AT TIME ZONE 'Europe/Prague') = 3
      AND (s."starts_at" AT TIME ZONE 'Europe/Prague')::time = '18:00'
  );
