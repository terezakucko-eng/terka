-- Board post (Nástěnka) announcing the 💌 Schránka přání a nápadů, pinned. Fixed id, so it is created once and can be edited in Administrace → Aktuality.
INSERT INTO "announcements" ("id", "title", "body", "is_pinned", "is_published") VALUES (
  '6fa06e6c-c505-4d7d-91ab-0bc119d3af9f',
  '💌 Nově: Schránka přání a nápadů',
  $body$<p>Máš nápad, přání nebo pochvalu? Nebo tě něco trápí? Napiš nám! Schránku najdeš v <a href="/ucet/schranka"><strong>Můj účet → Schránka</strong></a>.</p>
<ul>
<li>🔒 Vybereš si, jestli vzkaz zůstane jen mezi námi, nebo ho můžeme ukázat i na webu.</li>
<li>🙈 Klidně i anonymně.</li>
<li>💬 Odpovíme ti e-mailem i přímo v účtu.</li>
</ul>
<p>Co jsme díky vám zlepšili, uvidíš na stránce <a href="/schranka">Schránka přání a nápadů</a>.</p>
<p><a href="/ucet/schranka">👉 Napsat vzkaz</a></p>
<p>Těšíme se na tvoje vzkazy! 🐙</p>$body$,
  true,
  true
) ON CONFLICT ("id") DO NOTHING;
