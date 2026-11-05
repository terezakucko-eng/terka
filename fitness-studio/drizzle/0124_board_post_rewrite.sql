-- Board post (Dárky pro členy 2027) written plainly, as the studio asked; the next pop-up likewise.
UPDATE "announcements" SET
  "title" = '🎁 Členství 2027: dárky za včasné přihlášení a novinka – zmražení členství',
  "body" = $body$<p>Děkujeme všem, kdo s námi budou cvičit i v roce 2027. 💛 Kdo se přihlásí včas, dostane dárky. A pro všechny členy se závazkem máme od ledna novinku – zmražení členství.</p>
<h3>🎅 Fitness Ježíšek – do 30. 11.</h3>
<p>Přihlas se ke členství na rok 2027 do 30. listopadu a v prosinci tě navštíví Fitness Ježíšek s dárkem. 🎄</p>
<h3>🎁 4 lekce Reformer bez doplatku – do 31. 12.</h3>
<ul>
<li>Kdo si do 31. 12. 2026 sjedná nové členství se závazkem na rok 2027, dostane 4 lekce Reformer fusion bez doplatku.</li>
<li>Platí i pro Členství Reformer – k 8 lekcím měsíčně máš 4 navíc. Klidně na ně pozvi kamarádku. 💪</li>
<li>Lekce využiješ kdykoli během roku 2027. Na další Reformer se pak doplácí jako obvykle (250 Kč).</li>
<li>Členství na rok 2027 už máš zarezervované? Dárek dostáváš taky – lekce uvidíš v účtu od 1. 1. 2027. 🙂</li>
<li>Kdo se přihlásí až v lednu, dárek už nedostane.</li>
</ul>
<h3>❄️ Zmražení členství – od ledna 2027</h3>
<ul>
<li>Dovolená, nemoc nebo cokoli jiného? Dvakrát ročně si můžeš zmrazit členství na týden (7 dní po sobě), nejdříve od následujícího dne.</li>
<li>Za zmražený týden neplatíš – platba za daný měsíc se sníží podle počtu dní (u členství za 1 400 Kč zhruba o 320 Kč).</li>
<li>Zmrazíš si ho v Můj účet. Je-li platba za daný měsíc už uhrazena, sleva se odečte z následujícího měsíce.</li>
<li>Během zmražení se na lekce nepřihlašuješ. Rezervace na ten týden se samy zruší a vstupy se ti vrátí.</li>
<li>Zmražení můžeš zrušit až do jeho začátku.</li>
<li>Platí pro všechna členství se závazkem. Členství Reformer má i v tom měsíci všech 8 lekcí.</li>
</ul>
<p><a href="/cenik?rok=2027">👉 Zarezervovat členství na rok 2027</a></p>
<p><a href="/rozvrh">👉 Rezervace lekcí</a></p>$body$
WHERE "id" = 'ec9596c8-12e0-4cf2-97ff-d54610740a2d';
--> statement-breakpoint
UPDATE "content" SET "value" = 'Přihlas se ke členství na rok 2027 do 30. 11. a v prosinci tě navštíví Fitness Ježíšek 🎅. Kdo se přihlásí do konce roku, dostane 4 lekce Reformer bez doplatku. A novinka: dvakrát ročně si můžeš zmrazit členství na týden.', "updated_at" = now()
WHERE "key" = 'popupNext.text';
