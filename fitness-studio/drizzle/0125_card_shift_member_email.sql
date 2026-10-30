-- The studio's printer shifts the Pošli to dál backs 3 mm to the left on A4 – the backs are moved 3 mm right (Nastavení → Tisk).
INSERT INTO "settings" ("key", "value") VALUES ('passCardBackShiftMm', '3')
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
-- The board post about membership 2027 as an e-mail, ready in Administrace → Zprávy as a DRAFT: the studio checks it,
-- sends itself a test and sends it (only to clients who agreed to news). Fixed id, so it is created once.
INSERT INTO "campaigns" ("id", "channel", "purpose", "name", "subject", "body", "audience", "status")
SELECT '1b19f3f2-85a4-450e-a725-1e2a51640f4f', 'email', 'marketing',
  'Členství 2027 – dárky a zmražení členství',
  '🎁 Členství 2027: dárky za včasné přihlášení a zmražení členství',
  $body$Ahoj {{osloveni}},

děkujeme všem, kdo s námi budou cvičit i v roce 2027. 💛 Kdo se přihlásí včas, dostane dárky. A pro všechny členy se závazkem máme od ledna novinku – zmražení členství.

# 🎅 Fitness Ježíšek – do 30. 11.

Přihlas se ke členství na rok 2027 do 30. listopadu a v prosinci tě navštíví Fitness Ježíšek s dárkem. 🎄

# 🎁 4 lekce Reformer bez doplatku – do 31. 12.

• Kdo si do 31. 12. 2026 sjedná nové členství se závazkem na rok 2027, dostane 4 lekce Reformer fusion bez doplatku.
• Platí i pro Členství Reformer – k 8 lekcím měsíčně máš 4 navíc. Klidně na ně pozvi kamarádku. 💪
• Lekce využiješ kdykoli během roku 2027. Na další Reformer se pak doplácí jako obvykle (250 Kč).
• Členství na rok 2027 už máš zarezervované? Dárek dostáváš taky – lekce uvidíš v účtu od 1. 1. 2027. 🙂
• Kdo se přihlásí až v lednu, dárek už nedostane.

# ❄️ Zmražení členství – od ledna 2027

• Dovolená, nemoc nebo cokoli jiného? Dvakrát ročně si můžeš zmrazit členství na týden (7 dní po sobě), nejdříve od následujícího dne.
• Za zmražený týden neplatíš – platba za daný měsíc se sníží podle počtu dní (u členství za 1 400 Kč zhruba o 320 Kč).
• Zmrazíš si ho v Můj účet. Je-li platba za daný měsíc už uhrazena, sleva se odečte z následujícího měsíce.
• Během zmražení se na lekce nepřihlašuješ. Rezervace na ten týden se samy zruší a vstupy se ti vrátí.
• Zmražení můžeš zrušit až do jeho začátku.
• Platí pro všechna členství se závazkem. Členství Reformer má i v tom měsíci všech 8 lekcí.

**Zarezervuj si členství na rok 2027:** https://www.octopush.fit/cenik?rok=2027

Těšíme se na tebe! 💛
Tým OCTOPUSH$body$,
  '{"segment":"all"}'::jsonb, 'draft'
WHERE NOT EXISTS (SELECT 1 FROM "campaigns" WHERE "id" = '1b19f3f2-85a4-450e-a725-1e2a51640f4f');
