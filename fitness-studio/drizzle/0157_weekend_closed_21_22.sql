-- Weekend 21–22 Nov 2026: the studio is closed (the team is at a pilates course).
--
-- The lessons of that weekend say so in their note (where they have none), so nobody books them unknowingly…
UPDATE "class_sessions" SET "note" = 'Lekce se nekoná – o víkendu 21.–22. 11. je studio zavřené (jsme na kurzu pilates). Přihlášeným vracíme vstup nebo kredit na účet.'
WHERE "starts_at" >= '2026-11-21 00:00:00+01' AND "starts_at" < '2026-11-23 00:00:00+01'
  AND "status"::text = 'scheduled' AND coalesce(trim("note"), '') = '';
--> statement-breakpoint
-- …and those nobody is signed up for (not even on the waitlist) are cancelled right away. Lessons with clients are
-- cancelled by the studio in the admin – that gives back what they paid and lets them know by e-mail.
UPDATE "class_sessions" s SET "status" = 'cancelled'
WHERE s."starts_at" >= '2026-11-21 00:00:00+01' AND s."starts_at" < '2026-11-23 00:00:00+01'
  AND s."status"::text = 'scheduled'
  AND NOT EXISTS (SELECT 1 FROM "bookings" b WHERE b."session_id" = s."id" AND b."status"::text <> 'cancelled');
--> statement-breakpoint
-- The board post, pinned. Fixed id – created once, the studio can edit or unpin it in Administrace → Aktuality.
INSERT INTO "announcements" ("id", "title", "body", "is_pinned", "is_published") VALUES (
  '7c2e9a41-5d38-4b6f-8e17-3a90c4d1f5b2',
  '🧘‍♀️ O víkendu 21.–22. 11. máme zavřeno',
  $body$<p>Tento víkend, v sobotu 21. a v neděli 22. listopadu, bude studio zavřené. Jedeme na kurz pilates a vrátíme se s novou inspirací do lekcí. 💛</p>
<ul>
<li>Nedělní lekce <strong>Reformer fusion (17:00)</strong> a <strong>Zumba fitness (18:00)</strong> se nekonají.</li>
<li>Máš na některou rezervaci? Vstup nebo kredit ti vracíme na účet a dáme ti vědět e-mailem.</li>
<li>Zavřená bude i posilovací a cardio zóna a infrasauna.</li>
</ul>
<p>V pátek 20. 11. cvičíme podle rozvrhu a v pondělí 23. 11. jsme zpátky. 👉 <a href="/rozvrh?tyden=2026-11-23">Rezervuj si lekci na příští týden</a></p>
<p>Děkujeme za pochopení! 🐙</p>$body$,
  true,
  true
) ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- The same as an e-mail, ready in Administrace → Zprávy as a DRAFT: a service message (it's about the studio being
-- closed), for the members – the studio checks it, changes who gets it if it likes, and sends it itself. Created once.
INSERT INTO "campaigns" ("id", "channel", "purpose", "name", "subject", "body", "audience", "status")
SELECT '9d4b7f20-6c15-4e83-a2d9-51f08e3b6c74', 'email', 'service',
  'Zavřeno o víkendu 21.–22. 11.',
  'O víkendu 21.–22. 11. máme zavřeno',
  $body$Ahoj {{osloveni}},

tento víkend, v sobotu 21. a v neděli 22. listopadu, bude studio zavřené. Jedeme na kurz pilates a vrátíme se s novou inspirací do lekcí. 💛

• Nedělní lekce Reformer fusion (17:00) a Zumba fitness (18:00) se nekonají.
• Máš na některou rezervaci? Vstup nebo kredit ti vracíme na účet.
• Zavřená bude i posilovací a cardio zóna a infrasauna.

V pátek 20. 11. cvičíme podle rozvrhu a v pondělí 23. 11. jsme zpátky.

**Rezervuj si lekci na příští týden:** https://www.octopush.fit/rozvrh?tyden=2026-11-23

Děkujeme za pochopení a těšíme se na tebe! 💛
Tým OCTOPUSH$body$,
  '{"segment":"members"}'::jsonb, 'draft'
WHERE NOT EXISTS (SELECT 1 FROM "campaigns" WHERE "id" = '9d4b7f20-6c15-4e83-a2d9-51f08e3b6c74');
