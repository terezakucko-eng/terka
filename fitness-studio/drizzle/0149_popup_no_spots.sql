-- The Zumba SPECIAL pop-up: no free places under the buttons for now (the studio's wish) – switched back on in
-- Obsah webu → Vyskakovací okno → „Ukázat volná místa pod tlačítkem“ = ano.
UPDATE "content" SET "value" = '', "updated_at" = now() WHERE "key" = 'popup.showSpots' AND "value" = 'ano';
