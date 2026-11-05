-- Board post (Dárky pro členy 2027): simpler wording of who gets the 4 Reformer lessons, a friend can come on them,
-- those reserved already get the gift too (it shows in the account from 1. 1. 2027), freezing from the next day.
UPDATE "announcements" SET "body" = replace(replace(replace(replace(replace("body",
    'sjedná nové členství se závazkem – od listopadu, nebo rovnou na rok 2027 v předprodeji –,',
    'sjedná nové členství se závazkem na rok 2027,'),
  'k 8 Reformerům měsíčně máš ještě 4 navíc. 💪',
  'k 8 Reformerům měsíčně máš ještě 4 navíc – klidně na ně pozvi třeba kamarádku. 💪'),
  'Už máš členství na rok 2027 zarezervované? Lekce najdeš v Můj účet. ✅ Nové rezervace je dostanou hned po zaplacení.',
  'Už máš členství na rok 2027 zarezervované? Dárek dostáváš taky. Lekce na Reformer zdarma uvidíš v účtu od 1. 1. 2027 🙂'),
  '7 dní po sobě, nejdřív od zítřka.',
  '7 dní po sobě, nejdříve od následujícího dne.'),
  'Je-li platba za ten měsíc už zaplacená, sleva se odečte z té příští.',
  'Je-li platba za daný měsíc už uhrazena, sleva se odečte z následujícího měsíce.')
WHERE "id" = 'ec9596c8-12e0-4cf2-97ff-d54610740a2d';
