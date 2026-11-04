-- Board post (Nástěnka) about the Zumba SPECIAL evening on Monday 16 Nov 2026 with the guests from Olomouc, pinned.
-- Fixed id, so it is created once and can be edited in Administrace → Aktuality.
INSERT INTO "announcements" ("id", "title", "body", "is_pinned", "is_published") VALUES (
  '146aa9e2-80ab-437c-b082-47ecb7403616',
  '💃 Zumba SPECIAL s hosty z Olomouce – pondělí 16. 11.',
  $body$<p>16. listopadu chystáme taneční večer, jaký tu ještě nebyl! Přijedou za námi lektoři <strong>Marek a Martin</strong> – a samozřejmě nebude chybět ani Tereza. 💛</p>
<ul>
<li>🕔 <strong>17:00–17:45 Zumba Toning SPECIAL</strong> – choreografie s lehkými činkami, které zpevní celé tělo</li>
<li>🕕 <strong>18:00–19:00 Zumba fitness SPECIAL</strong> – hodina latinskoamerických rytmů a čisté radosti z pohybu</li>
</ul>
<p>Přijď na jednu, nebo si dej obě za sebou. Žádné zkušenosti nepotřebuješ – stačí chuť se hýbat a dobrá nálada. 🎉</p>
<h3>Kolik to stojí</h3>
<ul>
<li>členové mají obě lekce v ceně členství</li>
<li>s permanentkou se strhne 1 vstup</li>
<li>jednorázově 250 Kč či 220 kreditů</li>
<li>první návštěva je pro nováčky zdarma</li>
</ul>
<p>Přihlašování je otevřené pro všechny už teď. 👉 Rezervuj si místo: <a href="/rozvrh/5ea2983c-b146-45ae-b4b6-f86c43acc4c4">17:00 Zumba Toning SPECIAL</a> · <a href="/rozvrh/00d2c63c-54d6-4248-a5a0-842b458b2e96">18:00 Zumba fitness SPECIAL</a></p>
<p>Těšíme se na vás! 💃🕺</p>$body$,
  true,
  true
) ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- The bar at the top of the web: the Zumba SPECIAL until Monday 16 Nov, the link leads to the post above.
-- (Membership 2027 comes back to the bar from 17 Nov.)
INSERT INTO "content" ("key", "value", "updated_at") VALUES
  ('promoBar.text', '💃 Pondělí 16. 11.: Zumba SPECIAL s hosty z Olomouce', now()),
  ('promoBar.linkLabel', 'Víc na nástěnce', now()),
  ('promoBar.linkUrl', '/nastenka#146aa9e2-80ab-437c-b082-47ecb7403616', now()),
  ('promoBar.until', '2026-11-16', now()),
  ('promoBar.showSpots', '', now())
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updated_at" = now();
