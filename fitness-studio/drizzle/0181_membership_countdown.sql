-- Odpočet do konce akce Členství 2027 (přání studia 25. 11. 2026): lišta i pop-up ukážou živý odpočet i se sekundami.
-- Do 30. 11. přihlášky pro Fitness Ježíška, potom v pop-upu 4 lekce Reformer bez doplatku do konce roku.
-- Kód, který odpočet ještě nezná, klíče „….countdown“ přeskočí. Jen dokud v liště a pop-upu je dnešní akce
-- (co studio mezitím změnilo v Obsahu webu, zůstane). Opakované spuštění nic nezmění.

-- 1) Lišta: nový text a odkaz rovnou na členství (nový text = lišta se ukáže i těm, kdo ji zavřeli).
UPDATE "content" SET "value" = CASE "key"
    WHEN 'promoBar.text' THEN '🎅 Fitness Ježíšek už balí dárky pro členky 2027 – přihlas se do 30. 11.'
    WHEN 'promoBar.linkLabel' THEN 'Chci členství'
    WHEN 'promoBar.linkUrl' THEN '/cenik?rok=2027'
    END, "updated_at" = now()
WHERE "key" IN ('promoBar.text', 'promoBar.linkLabel', 'promoBar.linkUrl')
  AND EXISTS (SELECT 1 FROM "content" c WHERE c."key" = 'promoBar.text'
    AND c."value" = '🎁 Členství na rok 2027: přihlas se do 30. 11. a v prosinci přijde Fitness Ježíšek 🎅');
--> statement-breakpoint
-- 2) Odpočet v liště do konce 30. 11.
INSERT INTO "content" ("key", "value", "updated_at")
SELECT 'promoBar.countdown', '2026-11-30 | zbývá', now()
WHERE EXISTS (SELECT 1 FROM "content" c WHERE c."key" = 'promoBar.text'
    AND c."value" = '🎅 Fitness Ježíšek už balí dárky pro členky 2027 – přihlas se do 30. 11.')
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint
-- 3) Odpočet v pop-upu „Dárky pro členy na rok 2027“: do 30. 11. Ježíšek, potom 4× Reformer do 31. 12.
INSERT INTO "content" ("key", "value", "updated_at")
SELECT 'popupNext.countdown', $c$2026-11-30 | 🎅 Přihlášky pro Fitness Ježíška končí za
2026-12-31 | 🎁 4× Reformer bez doplatku – přihlášky končí za$c$, now()
WHERE EXISTS (SELECT 1 FROM "content" c WHERE c."key" = 'popupNext.title' AND c."value" = '🎁 Dárky pro členy na rok 2027')
ON CONFLICT ("key") DO NOTHING;
