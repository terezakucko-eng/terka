-- Pop-up „Dárky pro členy na rok 2027“: na konci i výhody, které členky mají celý rok (přání studia 25. 11. 2026) –
-- infrasauna zdarma, masáže za členskou cenu a slevy na akce. Jen dokud v pop-upu je dosavadní text (co studio
-- mezitím změnilo v Obsahu webu, zůstane). Opakované spuštění nic nezmění.
UPDATE "content" SET "value" = 'Přihlas se ke členství na rok 2027 do 30. 11. a v prosinci tě navštíví Fitness Ježíšek 🎅. Kdo se přihlásí do konce roku, dostane 4 lekce Reformer bez doplatku. A novinka: dvakrát ročně si můžeš zmrazit členství na týden. Jako členka máš navíc spoustu výhod – infrasaunu zdarma, levnější masáže, slevy na akce a další.', "updated_at" = now()
WHERE "key" = 'popupNext.text'
  AND "value" = 'Přihlas se ke členství na rok 2027 do 30. 11. a v prosinci tě navštíví Fitness Ježíšek 🎅. Kdo se přihlásí do konce roku, dostane 4 lekce Reformer bez doplatku. A novinka: dvakrát ročně si můžeš zmrazit členství na týden.';
