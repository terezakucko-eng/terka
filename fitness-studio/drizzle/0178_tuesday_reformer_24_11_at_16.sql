-- Reformer zdarma v úterý 24. 11. 2026 (migrace 0176 a 0177) se posouvá z 18:00 na 16:00, před Zumba Toning (přání studia
-- 23. 11. 2026). Z úterní řady v 18:00 vypadne, aby úprava „tento a následující“ neposunula i ostatní úterky.
-- Jen když stroje jsou v 16:00 volné. Kdo už je přihlášený, dostane od studia e-mail – tady se připraví jako koncept,
-- odeslat ho musí studio. Opakované spuštění nic nezmění.

-- 1) Koncept e-mailu pro přihlášené (jen když nějací jsou a lekce se opravdu posune).
WITH people AS (
  SELECT DISTINCT b."user_id" FROM "bookings" b JOIN "class_sessions" s ON s."id" = b."session_id"
  WHERE s."id" = '295a46a8-a154-4d21-b739-f2c4beb5598c' AND s."status"::text = 'scheduled' AND s."starts_at" = '2026-11-24 18:00:00+01'
    AND b."user_id" IS NOT NULL AND NOT b."is_hold" AND b."status"::text IN ('pending_payment', 'confirmed', 'waitlist')
)
INSERT INTO "campaigns" ("id", "channel", "purpose", "name", "subject", "body", "audience", "status")
SELECT 'fd8992e4-2861-4081-a4d3-cdb7ba240a83', 'email', 'service',
  'Reformer zdarma v úterý 24. 11. nově v 16:00',
  'Reformer zdarma v úterý nově v 16:00',
  $body$Ahoj {{osloveni}},

malá změna na zítřek: Reformer zdarma v úterý 24. 11. je nově v 16:00–17:00 místo v 18:00.

• Tvoje rezervace platí, jen v novém čase 16:00.
• Když ti 16:00 nevyhovuje, rezervaci si zruš v rozvrhu – je zdarma, takže o nic nepřijdeš.

A v 17:00 můžeš rovnou pokračovat na Zumba Toning. 💃

**Rozvrh:** https://www.octopush.fit/rozvrh

Těšíme se na tebe! 💛
Tým OCTOPUSH$body$,
  jsonb_build_object('segment', 'people', 'userIds', (SELECT jsonb_agg(p."user_id"::text) FROM people p)), 'draft'
WHERE EXISTS (SELECT 1 FROM people)
  AND NOT EXISTS (SELECT 1 FROM "campaigns" WHERE "id" = 'fd8992e4-2861-4081-a4d3-cdb7ba240a83')
  AND NOT EXISTS (
    SELECT 1 FROM "class_sessions" x JOIN "class_types" t ON t."id" = x."class_type_id"
    WHERE (t."slug" = 'reformer-fusion' OR x."class_type_id" = 'd2f6a8c4-3b17-4e59-9a0d-7c1e5b8f2a46')
      AND x."id" <> '295a46a8-a154-4d21-b739-f2c4beb5598c' AND x."status"::text <> 'cancelled'
      AND x."starts_at" < '2026-11-24 17:00:00+01' AND x."starts_at" + make_interval(mins => x."duration_min") > '2026-11-24 16:00:00+01'
  );
--> statement-breakpoint
-- 2) Posun na 16:00 a ven z řady.
UPDATE "class_sessions" s SET "starts_at" = '2026-11-24 16:00:00+01', "series_id" = NULL
WHERE s."id" = '295a46a8-a154-4d21-b739-f2c4beb5598c' AND s."status"::text = 'scheduled' AND s."starts_at" = '2026-11-24 18:00:00+01'
  AND NOT EXISTS (
    SELECT 1 FROM "class_sessions" x JOIN "class_types" t ON t."id" = x."class_type_id"
    WHERE (t."slug" = 'reformer-fusion' OR x."class_type_id" = 'd2f6a8c4-3b17-4e59-9a0d-7c1e5b8f2a46')
      AND x."id" <> s."id" AND x."status"::text <> 'cancelled'
      AND x."starts_at" < '2026-11-24 16:00:00+01'::timestamptz + make_interval(mins => s."duration_min")
      AND x."starts_at" + make_interval(mins => x."duration_min") > '2026-11-24 16:00:00+01'
  );
