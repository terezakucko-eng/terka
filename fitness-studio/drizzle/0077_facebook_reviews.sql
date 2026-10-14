-- Recenze z Facebooku (doporučení s textem). Facebook nemá hvězdičky – na webu se ukáže „Doporučuje“
-- a do průměru hvězdiček se nepočítají (rating 5 jen kvůli povinnému sloupci). Příjmení jen iniciálou.
INSERT INTO "reviews" ("author_name", "rating", "body", "status", "source", "created_at")
SELECT v.author, 5, v.body, 'approved', 'facebook', now() - v.n * interval '1 second'
FROM (VALUES
  (1, 'Lucie Z.', 'Skveli a sympaticti instruktori, skvela atmosfera i cviceni. Vrele doporucuji, urcite nebudete litovat.!'),
  (2, 'Andrea H.', 'motivují, jsou zábavní, profesionální a vstřícní...'),
  (3, 'Andrea Č.', 'Jsou neeeeejlepsi siroko daleko')
) AS v(n, author, body)
WHERE NOT EXISTS (SELECT 1 FROM "reviews" r WHERE r."body" = v.body)
  -- jen v databázi studia (má už recenze z Googlu) – ne v čerstvé databázi testů a vývoje
  AND EXISTS (SELECT 1 FROM "reviews" WHERE "source" = 'google');
--> statement-breakpoint
-- Dvě recenze z Googlu, které na webu chyběly (5 ★ podle Terezy). Datum podle Googlu: „před 7 / 6 lety“.
INSERT INTO "reviews" ("author_name", "rating", "body", "status", "source", "created_at")
SELECT v.author, 5, v.body, 'approved', 'google', now() - v.years * interval '1 year'
FROM (VALUES
  (7, 'Richard Ř.', 'Pro ty co se rádi hýbou'),
  (6, 'Radka K.', 'Super, jako vždy ;-)')
) AS v(years, author, body)
WHERE NOT EXISTS (SELECT 1 FROM "reviews" r WHERE r."body" = v.body)
  AND EXISTS (SELECT 1 FROM "reviews" WHERE "source" = 'google');
