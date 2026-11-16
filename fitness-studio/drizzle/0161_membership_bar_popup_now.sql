-- Lišta a pop-up: Členství 2027 už teď (16. 11.), ne až od zítřka – na přání studia místo Zumby SPECIAL s hosty z Olomouce.
-- Pop-up: připravené „Další vyskakovací okno“ (Dárky pro členy na rok 2027) se ukáže už dnes. Jen pokud je naplánované na 17. 11.
UPDATE "content" SET "value" = '2026-11-16', "updated_at" = now()
WHERE "key" = 'popupNext.from' AND "value" = '2026-11-17';
--> statement-breakpoint
-- Lišta: zpátky Členství 2027 (jako v migraci 0134) – jen dokud v ní je Zumba SPECIAL. Nový text, takže se ukáže i těm,
-- kdo lištu se Zumbou zavřeli.
UPDATE "content" SET "value" = CASE "key"
    WHEN 'promoBar.text' THEN '🎁 Členství na rok 2027: přihlas se do 30. 11. a v prosinci přijde Fitness Ježíšek 🎅'
    WHEN 'promoBar.linkLabel' THEN 'Všechno na nástěnce'
    WHEN 'promoBar.linkUrl' THEN '/nastenka#ec9596c8-12e0-4cf2-97ff-d54610740a2d'
    WHEN 'promoBar.until' THEN '2026-11-30'
    ELSE '' END, "updated_at" = now()
WHERE "key" IN ('promoBar.text', 'promoBar.linkLabel', 'promoBar.linkUrl', 'promoBar.until', 'promoBar.showSpots')
  AND EXISTS (SELECT 1 FROM "content" c WHERE c."key" = 'promoBar.text' AND c."value" LIKE '%Zumba SPECIAL%');
