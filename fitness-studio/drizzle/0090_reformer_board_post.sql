-- Board post (Nástěnka) about Členství Reformer from 1 January 2027, pinned. Fixed id, so it is created once and can be edited in Administrace → Aktuality.
INSERT INTO "announcements" ("id", "title", "body", "is_pinned", "is_published") VALUES (
  '1dd44d7a-151f-4695-8a47-a11e64aa898f',
  '✨ Nově: Členství Reformer od 1. 1. 2027',
  $body$<p>Miluješ Reformer fusion? Od ledna ho můžeš mít <strong>přímo v ceně členství</strong>. Členství Reformer si koupíš už teď, platit začne 1. 1. 2027.</p>
<ul>
<li>🧘‍♀️ <strong>8× Reformer fusion měsíčně v ceně</strong> – bez doplatku</li>
<li>⏰ Přednostní rezervace Reformeru – o týden dřív než ostatní členové</li>
<li>💪 Vše z klasického členství: neomezené skupinové lekce, posilovna a cardio zóna, infrasauna zdarma a další výhody</li>
<li>💳 2 500 Kč měsíčně, členství na 12 měsíců – první platbou máš zaplacený leden</li>
</ul>
<p>⚠️ <strong>Jen 4 členství</strong> – kdo dřív přijde, ten dřív cvičí.</p>
<p>Máš Členství 2026? To ti platí do konce roku a Členství Reformer na něj od ledna rovnou naváže.</p>
<p><a href="/cenik?rok=2027">👉 Členství Reformer v ceníku</a></p>$body$,
  true,
  true
) ON CONFLICT ("id") DO NOTHING;
