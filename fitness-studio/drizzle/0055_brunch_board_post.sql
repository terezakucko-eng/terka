-- Board post (Nástěnka) inviting to the first Barre + Brunch on Sat 31 Oct 2026, pinned. Fixed id, so it is created once and can be edited in Administrace → Aktuality.
INSERT INTO "announcements" ("id", "title", "body", "is_pinned", "is_published") VALUES (
  '0ed75e1b-a3cc-4b2c-9058-8cac246c731f',
  '🥐 Barre + Brunch – sobota 31. 10. v 8:30',
  $body$<p>Pojďme si užít příjemné podzimní sobotní ráno! Nejdřív si spolu zacvičíme <strong>Barre</strong> a pak si sedneme ke zdravé snídani, kterou pro vás připravíme přímo ve studiu.</p>
<ul>
<li>🕣 <strong>8:30–11:00</strong>, studio OCTOPUSH, Pospolitá 699/16</li>
<li>🥑 avokádové toasty, čerstvé ovoce, matcha a výběrová káva</li>
<li>👯‍♀️ jen <strong>8 míst</strong> – vezmi s sebou i kamarádku</li>
</ul>
<h3>Kolik to stojí</h3>
<ul>
<li>jednorázově 390 Kč, s kamarádkou 690 Kč za obě</li>
<li>kreditem 350 kreditů</li>
<li>členky mají cvičení v ceně členství a doplácí jen 150 Kč za snídani</li>
<li>s permanentkou 1 vstup + doplatek 150 Kč</li>
</ul>
<p><a href="/rozvrh/3f3a2507-1b0e-48c3-a9d8-d7d0afc7a21c">👉 Rezervuj si místo</a></p>
<p>Těšíme se na vás! 💛</p>$body$,
  true,
  true
) ON CONFLICT ("id") DO NOTHING;
