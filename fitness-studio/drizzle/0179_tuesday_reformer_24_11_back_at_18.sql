-- Reformer zdarma v úterý 24. 11. 2026 nakonec zůstává v 18:00, po Zumba Toningu (přání studia 23. 11. 2026) – vrací
-- se z 16:00 (migrace 0178) zpátky do úterní řady. Jen když jsou stroje v 18:00 volné. Kdo se mezitím přihlásil,
-- dostane od studia e-mail – tady se připraví jako koncept, odeslat ho musí studio. Koncept o posunu na 16:00 (0178),
-- pokud ještě nebyl odeslaný, se smaže. Opakované spuštění nic nezmění.

-- 1) Koncept e-mailu pro přihlášené (jen když nějací jsou a lekce se opravdu vrátí).
WITH people AS (
  SELECT DISTINCT b."user_id" FROM "bookings" b JOIN "class_sessions" s ON s."id" = b."session_id"
  WHERE s."id" = '295a46a8-a154-4d21-b739-f2c4beb5598c' AND s."status"::text = 'scheduled' AND s."starts_at" = '2026-11-24 16:00:00+01'
    AND b."user_id" IS NOT NULL AND NOT b."is_hold" AND b."status"::text IN ('pending_payment', 'confirmed', 'waitlist')
)
INSERT INTO "campaigns" ("id", "channel", "purpose", "name", "subject", "body", "audience", "status")
SELECT 'a045476b-5764-4598-a117-e11d3aed18dc', 'email', 'service',
  'Reformer zdarma v úterý 24. 11. v 18:00',
  'Reformer zdarma je zítra v 18:00',
  $body$Ahoj {{osloveni}},

Reformer zdarma v úterý 24. 11. je nakonec v 18:00–19:00, hned po Zumba Toningu. Omlouváme se za zmatek s časy.

• Tvoje rezervace platí, jen v čase 18:00.
• Když ti 18:00 nevyhovuje, rezervaci si zruš v rozvrhu – je zdarma, takže o nic nepřijdeš.

**Rozvrh:** https://www.octopush.fit/rozvrh

Těšíme se na tebe! 💛
Tým OCTOPUSH$body$,
  jsonb_build_object('segment', 'people', 'userIds', (SELECT jsonb_agg(p."user_id"::text) FROM people p)), 'draft'
WHERE EXISTS (SELECT 1 FROM people)
  AND NOT EXISTS (SELECT 1 FROM "campaigns" WHERE "id" = 'a045476b-5764-4598-a117-e11d3aed18dc')
  AND NOT EXISTS (
    SELECT 1 FROM "class_sessions" x JOIN "class_types" t ON t."id" = x."class_type_id"
    WHERE (t."slug" = 'reformer-fusion' OR x."class_type_id" = 'd2f6a8c4-3b17-4e59-9a0d-7c1e5b8f2a46')
      AND x."id" <> '295a46a8-a154-4d21-b739-f2c4beb5598c' AND x."status"::text <> 'cancelled'
      AND x."starts_at" < '2026-11-24 19:00:00+01' AND x."starts_at" + make_interval(mins => x."duration_min") > '2026-11-24 18:00:00+01'
  );
--> statement-breakpoint
-- 2) Zpátky na 18:00 a do úterní řady.
UPDATE "class_sessions" s SET "starts_at" = '2026-11-24 18:00:00+01', "series_id" = '00435959-5343-479d-a531-53f841063962'
WHERE s."id" = '295a46a8-a154-4d21-b739-f2c4beb5598c' AND s."status"::text = 'scheduled' AND s."starts_at" = '2026-11-24 16:00:00+01'
  AND NOT EXISTS (
    SELECT 1 FROM "class_sessions" x JOIN "class_types" t ON t."id" = x."class_type_id"
    WHERE (t."slug" = 'reformer-fusion' OR x."class_type_id" = 'd2f6a8c4-3b17-4e59-9a0d-7c1e5b8f2a46')
      AND x."id" <> s."id" AND x."status"::text <> 'cancelled'
      AND x."starts_at" < '2026-11-24 18:00:00+01'::timestamptz + make_interval(mins => s."duration_min")
      AND x."starts_at" + make_interval(mins => x."duration_min") > '2026-11-24 18:00:00+01'
  );
--> statement-breakpoint
-- 3) Neodeslaný koncept o posunu na 16:00 už neplatí.
DELETE FROM "campaigns"
WHERE "id" = 'fd8992e4-2861-4081-a4d3-cdb7ba240a83' AND "status"::text = 'draft'
  AND EXISTS (SELECT 1 FROM "class_sessions" WHERE "id" = '295a46a8-a154-4d21-b739-f2c4beb5598c' AND "starts_at" = '2026-11-24 18:00:00+01');
