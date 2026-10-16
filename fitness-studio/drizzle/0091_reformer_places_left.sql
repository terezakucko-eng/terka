-- Nástěnka: Členství Reformer – zbývají už jen 3 volná (místo „Jen 4 členství“). Jen pokud text v Aktualitách zatím nikdo neupravil.
UPDATE "announcements" SET
  "title" = CASE WHEN "title" = '✨ Nově: Členství Reformer od 1. 1. 2027' THEN '🔥 Členství Reformer od 1. 1. 2027 – zbývají už jen 3!' ELSE "title" END,
  "body" = replace("body", '<p>⚠️ <strong>Jen 4 členství</strong> – kdo dřív přijde, ten dřív cvičí.</p>',
    '<p>🔥 <strong>Zbývají už jen 3 volná členství na rok 2027!</strong> Kdo dřív přijde, ten dřív cvičí – neváhej.</p>')
WHERE "id" = '1dd44d7a-151f-4695-8a47-a11e64aa898f';
